import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsAdditionalBilling, OpsBillingCorrection, OpsBillingDispute, OpsBillingStatement } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { POST_EVENT_LIFECYCLE_STATE_READER, type PostEventLifecycleStateReader } from '@prism/contexts/event-lifecycle/post-event-reference';
import { URGENT_ISSUE_REFERENCE_READER, type UrgentIssueReferenceReader } from '@prism/contexts/live-ops/urgent-issue-reference';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { auditMetadata, billingCommandContext, requireBillingActor } from './billing-operations.utils';
import { mapAdditionalBilling, mapBillingCorrection, mapBillingDispute } from './billing-operations.mappers';
import type {
  BillingActor,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  CreateBillingDisputeInput,
  ResolveBillingDisputeInput,
  CreateAdditionalBillingInput,
  WaiveAdditionalBillingInput,
} from '../../contracts/billing-operations.types';

@Injectable()
export class BillingAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(POST_EVENT_LIFECYCLE_STATE_READER) private readonly postEventStateReader: PostEventLifecycleStateReader,
    @Inject(URGENT_ISSUE_REFERENCE_READER) private readonly urgentIssueReferenceReader: UrgentIssueReferenceReader,
  ) {}

  async requestBillingCorrection(eventId: string, input: RequestBillingCorrectionInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let statement: OpsBillingStatement | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<OpsBillingCorrection, ReturnType<typeof mapBillingCorrection>>({
      name: 'request_billing_correction', eventId, sideEffectMode: 'same_tx',
      context: billingCommandContext(eventId, 'request_billing_correction', input.idempotencyKey, actor),
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requireEvent(eventId);
        statement = await this.prisma.opsBillingStatement.findUnique({ where: { id: input.statementId } });
        if (!statement || statement.eventId !== eventId) throw new NotFoundException('Billing statement not found');
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsBillingCorrection.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Billing correction idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsBillingCorrection.create({ data: { id: `corr_${randomUUID()}`, eventId, statementId: statement!.id, reason: input.reason.trim(), correctedTotalAmount: input.correctedTotalAmount ?? null, status: 'pending', requestedBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (correction, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Requested billing correction for ${statement!.number}`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'billing_correction', affectedId: correction.id, affectedLabel: statement!.number, metadata: auditMetadata(actor, { statementId: statement!.id, reason: input.reason, correctedTotalAmount: input.correctedTotalAmount ?? null }) }, context); },
      project: (correction) => mapBillingCorrection(correction),
    });
  }

  async resolveBillingCorrection(eventId: string, correctionId: string, input: ResolveBillingCorrectionInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    let correction: OpsBillingCorrection | null = null;
    return this.workflowCommandService.execute<OpsBillingCorrection, ReturnType<typeof mapBillingCorrection>>({
      name: 'resolve_billing_correction', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        correction = await this.prisma.opsBillingCorrection.findUnique({ where: { id: correctionId } });
        if (!correction || correction.eventId !== eventId) throw new NotFoundException('Billing correction not found');
        if (correction.status !== 'pending') throw new BadRequestException('Billing correction has already been resolved');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsBillingCorrection.update({ where: { id: correctionId }, data: { status: input.action === 'approve' ? 'approved' : 'rejected', resolvedBy: actor.name, resolutionNotes: input.resolutionNotes?.trim() ?? null, resolvedAt: new Date() } }),
      sideEffects: async (resolved, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `${input.action === 'approve' ? 'Approved' : 'Rejected'} billing correction`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: input.action === 'approve' ? AuditActionType.Approve : AuditActionType.Update, affectedType: 'billing_correction', affectedId: resolved.id, affectedLabel: resolved.statementId, metadata: auditMetadata(actor, { resolutionNotes: input.resolutionNotes ?? '' }) }, context); },
      project: (resolved) => mapBillingCorrection(resolved),
    });
  }

  async createBillingDispute(eventId: string, input: CreateBillingDisputeInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let statement: OpsBillingStatement | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<OpsBillingDispute, ReturnType<typeof mapBillingDispute>>({
      name: 'create_billing_dispute', eventId, sideEffectMode: 'same_tx',
      context: billingCommandContext(eventId, 'create_billing_dispute', input.idempotencyKey, actor),
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requireEvent(eventId);
        statement = await this.prisma.opsBillingStatement.findUnique({ where: { id: input.statementId } });
        if (!statement || statement.eventId !== eventId) throw new NotFoundException('Billing statement not found');
        if (input.amount > statement.totalAmount) throw new BadRequestException('Dispute amount cannot exceed the statement total');
        if (input.milestoneId) {
          const milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: input.milestoneId } });
          if (!milestone || milestone.eventId !== eventId) throw new NotFoundException('Payment milestone not found');
        }
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsBillingDispute.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Billing dispute idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsBillingDispute.create({ data: { id: `dispute_${randomUUID()}`, eventId, statementId: statement!.id, milestoneId: input.milestoneId ?? null, amount: input.amount, reason: input.reason.trim(), status: 'open', raisedBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (dispute, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Opened billing dispute for ${statement!.number}`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'billing_dispute', affectedId: dispute.id, affectedLabel: statement!.number, metadata: auditMetadata(actor, { amount: input.amount, reason: input.reason }) }, context); },
      project: (dispute) => mapBillingDispute(dispute),
    });
  }

  async resolveBillingDispute(eventId: string, disputeId: string, input: ResolveBillingDisputeInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    return this.workflowCommandService.execute<OpsBillingDispute, ReturnType<typeof mapBillingDispute>>({
      name: 'resolve_billing_dispute', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const dispute = await this.prisma.opsBillingDispute.findUnique({ where: { id: disputeId } });
        if (!dispute || dispute.eventId !== eventId) throw new NotFoundException('Billing dispute not found');
        if (dispute.status !== 'open') throw new BadRequestException('Billing dispute has already been resolved');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsBillingDispute.update({ where: { id: disputeId }, data: { status: input.action === 'resolve' ? 'resolved' : 'rejected', resolvedBy: actor.name, resolutionNotes: input.resolutionNotes.trim(), resolvedAt: new Date() } }),
      sideEffects: async (dispute, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `Resolved billing dispute`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Update, affectedType: 'billing_dispute', affectedId: dispute.id, affectedLabel: dispute.statementId, metadata: auditMetadata(actor, { resolution: input.action, resolutionNotes: input.resolutionNotes }) }, context); },
      project: (dispute) => mapBillingDispute(dispute),
    });
  }

  async createAdditionalBilling(eventId: string, input: CreateAdditionalBillingInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let issue: { id: string; eventId: string } | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<OpsAdditionalBilling, ReturnType<typeof mapAdditionalBilling>>({
      name: 'create_additional_billing', eventId, sideEffectMode: 'same_tx',
      context: billingCommandContext(eventId, 'create_additional_billing', input.idempotencyKey, actor),
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requirePostEventState(eventId);
        issue = await this.urgentIssueReferenceReader.findUrgentIssueForEvent(eventId, input.urgentIssueId);
        if (!issue) throw new NotFoundException('Urgent issue not found');
        await this.requireApprovedBillingSource(eventId, input.billingSourceId);
      },
      validateStateInTransaction: async (context) => {
        await this.requirePostEventState(eventId, context);
        issue = await this.urgentIssueReferenceReader.findUrgentIssueForEvent(eventId, input.urgentIssueId, context);
        if (!issue) throw new NotFoundException('Urgent issue not found');
        await this.requireApprovedBillingSource(eventId, input.billingSourceId, context?.prisma ?? this.prisma);
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsAdditionalBilling.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Additional billing idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsAdditionalBilling.create({ data: { id: `addbill_${randomUUID()}`, eventId, urgentIssueId: issue!.id, billingSourceId: input.billingSourceId, description: input.description.trim(), amount: input.amount, status: 'issued', createdBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (billing, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Issued post-event additional billing`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'additional_billing', affectedId: billing.id, affectedLabel: input.description, metadata: auditMetadata(actor, { urgentIssueId: issue!.id, amount: input.amount }) }, context); },
      project: (billing) => mapAdditionalBilling(billing),
    });
  }

  async waiveAdditionalBilling(eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    return this.workflowCommandService.execute<OpsAdditionalBilling, ReturnType<typeof mapAdditionalBilling>>({
      name: 'waive_additional_billing', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const billing = await this.prisma.opsAdditionalBilling.findUnique({ where: { id: additionalBillingId } });
        if (!billing || billing.eventId !== eventId) throw new NotFoundException('Additional billing not found');
        if (billing.status !== 'issued') throw new BadRequestException('Only an issued additional bill can be waived');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsAdditionalBilling.update({ where: { id: additionalBillingId }, data: { status: 'waived', waiverReason: input.reason.trim(), waivedBy: actor.name, waivedAt: new Date() } }),
      sideEffects: async (billing, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `Waived post-event additional billing`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Update, affectedType: 'additional_billing', affectedId: billing.id, affectedLabel: billing.description, metadata: auditMetadata(actor, { waiverReason: input.reason }) }, context); },
      project: (billing) => mapAdditionalBilling(billing),
    });
  }

  /** Additional billing must trace to an approved source of the same event; unapproved or foreign sources are refused. */
  private async requireApprovedBillingSource(eventId: string, billingSourceId: string, db: PrismTransactionContext['prisma'] | PrismService = this.prisma) {
    const source = await db.opsBillingSource.findUnique({ where: { id: billingSourceId } });
    if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
    if (source.status !== 'approved') throw new BadRequestException('Additional billing must trace to an approved billing source');
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requirePostEventState(eventId: string, context?: PrismTransactionContext) {
    const event = await this.postEventStateReader.findPostEventState(eventId, context);
    if (!event) throw new NotFoundException('Event not found');
    if (!event.actualEndedAt) throw new BadRequestException('Post-event additional billing requires a recorded event end');
    return event;
  }
}
