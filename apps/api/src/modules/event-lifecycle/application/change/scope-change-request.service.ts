import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsScopeChangeRequest, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type {
  PrismClientChangeRequest,
  PrismScopeChangeRequest,
  PrismScopeChangeStatus,
  ReviewScopeChangeRequestInput,
  ScopeChangeCategory,
  SubmitScopeChangeRequestInput,
} from '@prism/types';
import { consumeApprovedFreezeException } from './freeze-exception-consumption';

// A scope change is open until PMCM approves or rejects it; only an open request can be reviewed.
type ScopeEvent = Prisma.OpsEventGetPayload<{ include: { inquiry: { select: { email: true } } } }>;

const OPEN_STATUSES: PrismScopeChangeStatus[] = ['submitted', 'under_review'];

// Client-facing wording: a submitted request is still under review, and a rejection is "not approved".
const CLIENT_SCOPE_CHANGE_STATUS: Record<PrismScopeChangeStatus, PrismClientChangeRequest['status']> = {
  submitted: 'under_review',
  under_review: 'under_review',
  approved: 'approved',
  rejected: 'not_approved',
  withdrawn: 'withdrawn',
};

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

// Explicit mapping: the Prisma row also carries requestedById and internal references that stay server-side.
export function mapScopeChangeRequest(value: OpsScopeChangeRequest): PrismScopeChangeRequest {
  return {
    id: value.id,
    eventId: value.eventId,
    requestedByRole: value.requestedByRole as PrismScopeChangeRequest['requestedByRole'],
    requestedBy: value.requestedBy,
    title: value.title,
    description: value.description,
    category: value.category as ScopeChangeCategory,
    status: value.status as PrismScopeChangeStatus,
    decisionReason: value.decisionReason,
    clientResponse: value.clientResponse,
    impacts: { billing: value.billingImpact, supplier: value.supplierImpact, coordinator: value.coordinatorImpact, floorplan: value.floorplanImpact },
    impactReviewedAt: iso(value.impactReviewedAt),
    freezeExceptionId: value.freezeExceptionId,
    addendumId: value.addendumId,
    reviewedBy: value.reviewedBy,
    decidedBy: value.decidedBy,
    submittedAt: value.submittedAt.toISOString(),
    decidedAt: iso(value.decidedAt),
    withdrawnAt: iso(value.withdrawnAt),
  };
}

/**
 * Client-safe projection. Only the title, category, neutral status, PMCM's client response, and update time leave
 * the server; decision reasons, impact flags, freeze exception and addendum links, and PMCM identities do not.
 */
export function toClientScopeChangeRequest(value: OpsScopeChangeRequest): PrismClientChangeRequest {
  return {
    id: value.id,
    source: 'scope_change',
    requestedChange: value.title,
    category: value.category as ScopeChangeCategory,
    status: CLIENT_SCOPE_CHANGE_STATUS[value.status as PrismScopeChangeStatus] ?? 'under_review',
    clientResponse: value.clientResponse,
    updatedAt: value.updatedAt.toISOString(),
  };
}

@Injectable()
export class ScopeChangeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notifications: NotificationOutboxWriter,
  ) {}

  private async requireEvent(eventId: string, prisma: PrismaService | Prisma.TransactionClient = this.prisma): Promise<ScopeEvent> {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  /**
   * Clients act only as the verified primary client of this event: ownership is the same email check used for
   * event reads, and the event must be unlocked for the client portal.
   */
  private async requirePrimaryClient(actor: ResolvedEventOpsActor, event: ScopeEvent, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.Client], resource, event.id);
    if (!actor.verified) throw new ForbiddenException('Scope changes require a verified client session');
    await this.access.requireCanReadEvent(actor, event, resource);
  }

  private async requireOperator(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
  }

  /** Client submissions are scoped to the client's own event; PMCM may log one on the client's behalf. */
  async submit(eventId: string, input: SubmitScopeChangeRequestInput, actor: ResolvedEventOpsActor): Promise<PrismScopeChangeRequest> {
    const event = await this.requireEvent(eventId);
    if (actor.role === OpsUserRole.Client) {
      await this.requirePrimaryClient(actor, event, 'scope change request');
    } else {
      await this.requireOperator(actor, eventId, 'scope change request');
    }
    if (event.archived) throw new BadRequestException('Archived events cannot accept scope change requests');
    const requestedByRole = actor.role === OpsUserRole.Client ? 'client' : 'pmcm';
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.opsScopeChangeRequest.create({
        data: {
          id: `scope_change_${randomUUID()}`,
          eventId,
          requestedByRole,
          requestedBy: actor.name,
          requestedById: actor.id ?? null,
          title: input.title.trim(),
          description: input.description.trim(),
          category: input.category,
          status: 'submitted',
        },
      });
      await writeAudit(this.audit, eventId, actor.name, 'Submitted scope change request', { actorRole: actor.role, actionType: 'create', category: 'events', affectedType: 'scope_change_request', affectedId: value.id, metadata: { requestedByRole, category: value.category } }, { prisma: tx, correlationId: value.id, actorId: actor.id });
      if (requestedByRole === 'client') {
        // PMCM is alerted to every client-originated request; the message names the request, not its details.
        await writeNotification(this.notifications, eventId, 'PMCM Admin', `Scope change requested for ${event.eventName}: ${value.title}`, undefined, { idempotencyKey: `scope-change-submitted:${value.id}` }, { prisma: tx, correlationId: value.id });
      }
      return mapScopeChangeRequest(value);
    }, { isolationLevel: 'Serializable' });
  }

  /** The primary client may withdraw a request only while PMCM has not yet picked it up. */
  async withdraw(eventId: string, requestId: string, actor: ResolvedEventOpsActor): Promise<PrismScopeChangeRequest> {
    const event = await this.requireEvent(eventId);
    await this.requirePrimaryClient(actor, event, 'scope change withdrawal');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.opsScopeChangeRequest.findFirst({ where: { id: requestId, eventId } });
      if (!existing) throw new NotFoundException('Scope change request not found');
      const withdrawn = await tx.opsScopeChangeRequest.updateMany({
        where: { id: requestId, eventId, status: 'submitted' },
        data: { status: 'withdrawn', withdrawnAt: new Date() },
      });
      if (withdrawn.count !== 1) throw new BadRequestException('Only a submitted scope change request can be withdrawn');
      const value = await tx.opsScopeChangeRequest.findUniqueOrThrow({ where: { id: requestId } });
      await writeAudit(this.audit, eventId, actor.name, 'Withdrew scope change request', { actorRole: actor.role, actionType: 'update', category: 'events', affectedType: 'scope_change_request', affectedId: requestId, metadata: { previousStatus: existing.status } }, { prisma: tx, correlationId: requestId, actorId: actor.id });
      return mapScopeChangeRequest(value);
    }, { isolationLevel: 'Serializable' });
  }

  /** PMCM register: every request for the event with its internal decision and impact state. */
  async listForPmcm(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismScopeChangeRequest[]> {
    await this.requireOperator(actor, eventId, 'scope change register');
    await this.requireEvent(eventId);
    const values = await this.prisma.opsScopeChangeRequest.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } });
    return values.map(mapScopeChangeRequest);
  }

  /** Client projection of this event's scope changes, read under the same event access rule as other client reads. */
  async listClientRequests(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismClientChangeRequest[]> {
    const event = await this.requireEvent(eventId);
    await this.access.requireCanReadEvent(actor, event, 'scope change requests');
    const values = await this.prisma.opsScopeChangeRequest.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } });
    return values.map(toClientScopeChangeRequest);
  }

  /**
   * PMCM decision. Each transition is a conditional write on the open status, so a request is decided once.
   * Approval on a frozen event consumes an approved freeze exception in the same transaction, so a failed approval
   * leaves the exception unused.
   */
  async review(eventId: string, requestId: string, input: ReviewScopeChangeRequestInput, actor: ResolvedEventOpsActor): Promise<PrismScopeChangeRequest> {
    await this.requireOperator(actor, eventId, 'scope change review');
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.reviewInTransaction(eventId, requestId, input, actor);
      } catch (error) {
        if (attempt >= 2 || typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2034') throw error;
      }
    }
  }

  private reviewInTransaction(eventId: string, requestId: string, input: ReviewScopeChangeRequestInput, actor: ResolvedEventOpsActor) {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(eventId, tx);
      if (event.archived) throw new BadRequestException('Archived events cannot accept scope change decisions');
      const existing = await tx.opsScopeChangeRequest.findFirst({ where: { id: requestId, eventId } });
      if (!existing) throw new NotFoundException('Scope change request not found');
      if (!OPEN_STATUSES.includes(existing.status as PrismScopeChangeStatus)) throw new BadRequestException(`Scope change request is already ${existing.status}`);
      const now = new Date();
      if (input.decision === 'start_review') {
        await this.startReview(tx, eventId, actor, requestId, existing, now);
      } else if (input.decision === 'reject') {
        await this.reject(tx, eventId, actor, requestId, existing, input, now);
      } else {
        await this.approve(tx, event, actor, requestId, existing, input, now);
      }
      return mapScopeChangeRequest(await tx.opsScopeChangeRequest.findUniqueOrThrow({ where: { id: requestId } }));
    }, { isolationLevel: 'Serializable' });
  }

  private async startReview(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, requestId: string, existing: OpsScopeChangeRequest, now: Date) {
    if (existing.status !== 'submitted') throw new BadRequestException('Scope change request is already under review');
    await this.requireTransition(tx, { id: requestId, eventId, status: 'submitted' }, { status: 'under_review', reviewStartedAt: now, reviewedBy: actor.name });
    await this.recordReviewAudit(tx, eventId, actor, requestId, 'Started scope change review', 'update', { previousStatus: existing.status });
  }

  private async reject(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, requestId: string, existing: OpsScopeChangeRequest, input: Extract<ReviewScopeChangeRequestInput, { decision: 'reject' }>, now: Date) {
    await this.requireTransition(tx, { id: requestId, eventId, status: { in: OPEN_STATUSES } }, {
      status: 'rejected', decisionReason: input.decisionReason.trim(), clientResponse: input.clientResponse?.trim() || null, decidedBy: actor.name, decidedAt: now, reviewedBy: actor.name,
    });
    await this.recordReviewAudit(tx, eventId, actor, requestId, 'Rejected scope change request', 'reject', { previousStatus: existing.status, decisionReason: input.decisionReason.trim() });
  }

  /** Read-only checks run before the single-use consumption so a refused approval leaves the exception unused. */
  private async approve(tx: Prisma.TransactionClient, event: ScopeEvent, actor: ResolvedEventOpsActor, requestId: string, existing: OpsScopeChangeRequest, input: Extract<ReviewScopeChangeRequestInput, { decision: 'approve' }>, now: Date) {
    const eventId = event.id;
    const addendumId = input.addendumId ? await this.requireEventAddendum(tx, eventId, input.addendumId) : null;
    const freezeExceptionId = event.freezeStatus === 'frozen'
      ? await this.consumeFreezeExceptionForApproval(tx, eventId, input.freezeExceptionId)
      : null;
    await this.requireTransition(tx, { id: requestId, eventId, status: { in: OPEN_STATUSES } }, {
      status: 'approved',
      billingImpact: input.impacts.billing,
      supplierImpact: input.impacts.supplier,
      coordinatorImpact: input.impacts.coordinator,
      floorplanImpact: input.impacts.floorplan,
      impactReviewedAt: now,
      freezeExceptionId,
      addendumId,
      clientResponse: input.clientResponse?.trim() || null,
      decidedBy: actor.name,
      decidedAt: now,
      reviewedBy: actor.name,
    });
    await this.recordReviewAudit(tx, eventId, actor, requestId, 'Approved scope change request', 'approve', { previousStatus: existing.status, impacts: input.impacts, freezeExceptionId, addendumId });
  }

  private async requireTransition(tx: Prisma.TransactionClient, where: Prisma.OpsScopeChangeRequestWhereInput & { id: string; eventId: string }, data: Prisma.OpsScopeChangeRequestUncheckedUpdateManyInput) {
    const updated = await tx.opsScopeChangeRequest.updateMany({ where, data });
    if (updated.count !== 1) throw new BadRequestException('Scope change request changed before this decision was recorded; reload and try again');
  }

  private async consumeFreezeExceptionForApproval(tx: Prisma.TransactionClient, eventId: string, exceptionId: string | undefined) {
    if (!exceptionId) throw new BadRequestException('Frozen events require an approved freeze exception before a scope change is approved');
    await consumeApprovedFreezeException(tx, eventId, exceptionId);
    return exceptionId;
  }

  private async requireEventAddendum(tx: Prisma.TransactionClient, eventId: string, addendumId: string) {
    const addendum = await tx.opsAddendum.findFirst({ where: { id: addendumId, eventId }, select: { id: true } });
    if (!addendum) throw new BadRequestException('Addendum was not found for this event');
    return addendum.id;
  }

  private recordReviewAudit(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, requestId: string, action: string, actionType: string, metadata: Record<string, unknown>) {
    return writeAudit(this.audit, eventId, actor.name, action, { actorRole: actor.role, actionType, category: 'events', affectedType: 'scope_change_request', affectedId: requestId, metadata }, { prisma: tx, correlationId: requestId, actorId: actor.id });
  }
}
