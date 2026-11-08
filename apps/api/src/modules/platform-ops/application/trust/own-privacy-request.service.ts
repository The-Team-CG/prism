import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole, PrivacyRequestStatus } from '@prism/kernel/event-core';
import type { PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from '@prism/types';
import { AuditService } from './audit.service';
import { mapOwnPrivacyRequest, OPEN_PRIVACY_REQUEST_STATUSES, privacyRequestDueAt } from './privacy-request.mapper';

/** A requester's own history is a short list, so it is capped rather than paged. */
export const OWN_PRIVACY_REQUEST_LIST_LIMIT = 50;

type Requester = {
  id: string;
  name: string;
  email: string;
  subjectType: 'client' | 'supplier';
};

/**
 * Identity comes only from the verified session actor: the role decides the subject type and the token email
 * decides the subject. Nothing the caller sends can change who the request is about.
 */
function requesterOf(actor: ResolvedEventOpsActor): Requester {
  if (actor.role !== OpsUserRole.Client && actor.role !== OpsUserRole.Supplier) {
    throw new ForbiddenException('Only clients and suppliers can file their own privacy requests');
  }
  const id = actor.id?.trim();
  const name = actor.name?.trim();
  const email = actor.email?.trim().toLowerCase();
  if (actor.verified !== true || !id || !name || !email) {
    throw new ForbiddenException('A verified client or supplier account is required for privacy requests');
  }
  return { id, name, email, subjectType: actor.role };
}

/**
 * The subject a requester's own requests are filed under. A PMCM-logged request about the same person may carry
 * the native `account` subject type, so both spellings count as theirs.
 */
function ownSubjectWhere(requester: Requester): Prisma.OpsPrivacyRequestWhereInput {
  return {
    subjectEmail: requester.email,
    subjectType: { in: [requester.subjectType, 'account'] },
  };
}

/** Self-service privacy requests: a client or supplier files one and tracks it. PMCM still verifies and executes it. */
@Injectable()
export class OwnPrivacyRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async submit(input: SubmitOwnPrivacyRequestInput, actor: ResolvedEventOpsActor): Promise<PrismOwnPrivacyRequest> {
    const requester = requesterOf(actor);
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Serialize submissions per requester so two concurrent requests cannot both pass the open-request check below.
      const lockKey = `privacy-self-service:${requester.email}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`; // QUERY_AUDIT_RAW_SQL: one fixed lock key per requester email, taken before the duplicate check in the same transaction.

      const open = await tx.opsPrivacyRequest.findFirst({
        where: {
          ...ownSubjectWhere(requester),
          requestType: input.requestType,
          status: { in: [...OPEN_PRIVACY_REQUEST_STATUSES] },
        },
        select: { id: true },
      });
      if (open) {
        throw new ConflictException(
          `You already have an open ${input.requestType} request. PMCM is handling it; submit another only after it closes.`,
        );
      }

      const submittedAt = new Date();
      const request = await tx.opsPrivacyRequest.create({
        data: {
          id: `priv_${randomUUID()}`,
          createdAt: submittedAt,
          dueAt: privacyRequestDueAt(submittedAt),
          eventId: null,
          subjectType: requester.subjectType,
          subjectEmail: requester.email,
          subjectName: requester.name,
          requestType: input.requestType,
          status: PrivacyRequestStatus.Submitted,
          requestNotes: input.details ?? '',
          createdBy: requester.name,
          source: 'self_service',
        },
      });

      await this.auditService.audit(undefined, requester.name, `Logged privacy request: ${input.requestType}`, {
        actorRole: actor.role,
        actorEmail: requester.email,
        actionType: AuditActionType.Create,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: requester.email,
        metadata: { actorId: requester.id, requestType: input.requestType, subjectType: requester.subjectType, source: 'self_service' },
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: requester.id });

      return mapOwnPrivacyRequest(request);
    });
  }

  async listOwn(actor: ResolvedEventOpsActor): Promise<PrismOwnPrivacyRequest[]> {
    const requester = requesterOf(actor);
    const rows = await this.prisma.opsPrivacyRequest.findMany({
      where: ownSubjectWhere(requester),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: take is OWN_PRIVACY_REQUEST_LIST_LIMIT, a fixed cap on one requester's own history.
      take: OWN_PRIVACY_REQUEST_LIST_LIMIT,
    });
    return rows.map((row) => mapOwnPrivacyRequest(row));
  }
}
