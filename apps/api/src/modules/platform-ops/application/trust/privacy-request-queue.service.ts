import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { PLATFORM_REFERENCE_READ_MODEL, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import {
  PRISM_PRIVACY_REQUEST_UNASSIGNED,
  type AssignPrivacyRequestInput,
  type ListPrivacyRequestsQuery,
  type PrismPrivacyRequest,
  type PrismPrivacyRequestPage,
} from '@prism/types';
import { AuditService } from './audit.service';
import { mapPrivacyRequest, OPEN_PRIVACY_REQUEST_STATUSES, type OpsPrivacyRequestRecord } from './privacy-request.mapper';
import { requireVerifiedTrustActor } from './verified-trust-actor';

/** Builds the Prisma filter for the queue; `overdue` and `open` are evaluated against one `now`. */
export function privacyRequestQueueWhere(query: ListPrivacyRequestsQuery, now: Date): Prisma.OpsPrivacyRequestWhereInput {
  const open = { in: [...OPEN_PRIVACY_REQUEST_STATUSES] };
  const and: Prisma.OpsPrivacyRequestWhereInput[] = [];
  if (query.eventId) and.push({ eventId: query.eventId });
  if (query.status === 'open') and.push({ status: open });
  else if (query.status !== 'all') and.push({ status: query.status });
  if (query.requestType !== 'all') and.push({ requestType: query.requestType });
  if (query.subjectType !== 'all') and.push({ subjectType: query.subjectType });
  if (query.assignedTo) {
    and.push({ assignedTo: query.assignedTo === PRISM_PRIVACY_REQUEST_UNASSIGNED ? null : query.assignedTo });
  }
  if (query.overdue === true) and.push({ status: open, dueAt: { lt: now } });
  if (query.overdue === false) and.push({ OR: [{ status: { notIn: [...OPEN_PRIVACY_REQUEST_STATUSES] } }, { dueAt: { gte: now } }] });
  return and.length ? { AND: and } : {};
}

/**
 * PMCM privacy request queue: filtered, paged reads ordered by SLA deadline, and audited operator assignment.
 * Execution and review stay in PrivacyOperationsService.
 */
@Injectable()
export class PrivacyRequestQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() @Inject(PLATFORM_REFERENCE_READ_MODEL)
    private readonly platformReferences: PlatformReferenceReadModel | undefined,
  ) {}

  async listRequests(query: ListPrivacyRequestsQuery, now: Date = new Date()): Promise<PrismPrivacyRequestPage> {
    const where = privacyRequestQueueWhere(query, now);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.opsPrivacyRequest.count({ where }),
      this.prisma.opsPrivacyRequest.findMany({
        where,
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        skip: query.page * query.limit,
        take: query.limit,
      }),
    ]);
    const items = rows.map((row: OpsPrivacyRequestRecord) => mapPrivacyRequest(row, now));
    return { items, page: query.page, limit: query.limit, total, hasMore: (query.page + 1) * query.limit < total };
  }

  async assignRequest(requestId: string, input: AssignPrivacyRequestInput, actor: ResolvedEventOpsActor): Promise<PrismPrivacyRequest> {
    const verifiedActor = requireVerifiedTrustActor(actor, 'privacy request assignment');
    if (verifiedActor.role !== OpsUserRole.PmcmAdmin) {
      throw new ForbiddenException('Only a verified PMCM operator may assign privacy requests');
    }
    const assignee = input.assignedTo
      ? await this.requirePlatformReferences().findApprovedPmcmOperator(input.assignedTo)
      : null;
    if (input.assignedTo && !assignee) {
      throw new BadRequestException('Privacy requests can only be assigned to an approved PMCM operator');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.opsPrivacyRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Privacy request not found');
      if (!(OPEN_PRIVACY_REQUEST_STATUSES as readonly string[]).includes(request.status)) {
        throw new BadRequestException('Only open privacy requests can be assigned');
      }
      const previousAssignee = request.assignedTo ?? null;
      const assignedTo = assignee?.id ?? null;
      if (previousAssignee === assignedTo) return mapPrivacyRequest(request);

      const changed = await tx.opsPrivacyRequest.updateMany({
        where: { id: requestId, status: request.status, assignedTo: previousAssignee },
        data: { assignedTo },
      });
      if (changed.count !== 1) throw new BadRequestException('Privacy request changed while it was being assigned; reload and retry');
      const saved = await tx.opsPrivacyRequest.findUniqueOrThrow({ where: { id: requestId } });
      await this.auditService.audit(request.eventId ?? undefined, verifiedActor.name, assignedTo ? 'Assigned privacy request' : 'Unassigned privacy request', {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: 'Privacy request assignment',
        metadata: { actorId: verifiedActor.id, requestId: request.id, previousAssignee, assignedTo },
      }, { prisma: tx, correlationId: `privacy:${request.id}:assignment`, actorId: verifiedActor.id });
      return mapPrivacyRequest(saved);
    });
  }

  private requirePlatformReferences() {
    if (!this.platformReferences) throw new ServiceUnavailableException('Platform reference read model is unavailable');
    return this.platformReferences;
  }
}
