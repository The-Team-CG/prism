import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEventDecision, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import {
  AuditActionType,
  AuditCategory,
  OpsUserRole,
} from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { CANCELLATION_FEE_POLICY, cancellationFeeBounds, type EventDecisionInput, type PrismCancellationSummary, type PrismVenueConfirmationTask, type ResolveVenueConfirmationInput } from '@prism/types';
import { COMMERCIAL_FACTS_READER, type CommercialFactsReader } from '@prism/contexts/read-models/commercial-facts-reader';
import { STAFFING_COMMANDS, type StaffingCommands } from '@prism/contexts/operations';
import { CONFIRMED_CANCELLATION_FEE_WRITER, type ConfirmedCancellationFeeWriter, EVENT_DECISION_SUPPLIER_OWNER, type EventDecisionSupplierOwner } from '@prism/contexts/commercial';

@Injectable()
export class EventDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationWriter: NotificationOutboxWriter,
    @Inject(STAFFING_COMMANDS) private readonly staffingCommands: StaffingCommands,
    @Inject(EVENT_DECISION_SUPPLIER_OWNER) private readonly supplierDecisionOwner: EventDecisionSupplierOwner,
    @Inject(CONFIRMED_CANCELLATION_FEE_WRITER) private readonly cancellationFeeWriter: ConfirmedCancellationFeeWriter,
    @Inject(COMMERCIAL_FACTS_READER) private readonly commercialFacts: CommercialFactsReader,
  ) {}

  async venueConfirmations(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismVenueConfirmationTask[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'venue confirmations', eventId);
    // QUERY_AUDIT_ALLOW_UNBOUNDED: one row per postponement of a single event.
    const rows = await this.prisma.opsVenueConfirmationTask.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map((row) => this.mapVenueTask(row));
  }

  async resolveVenueConfirmation(eventId: string, taskId: string, input: ResolveVenueConfirmationInput, actor: ResolvedEventOpsActor): Promise<PrismVenueConfirmationTask> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'venue confirmation', eventId);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.opsVenueConfirmationTask.findFirst({ where: { id: taskId, eventId } });
      if (!task) throw new NotFoundException('Venue confirmation not found');
      if (task.status !== 'open') throw new BadRequestException('This venue confirmation is already resolved');
      const updated = await tx.opsVenueConfirmationTask.update({ where: { id: taskId }, data: { status: input.outcome, note: input.note ?? '', resolvedAt: new Date(), resolvedBy: actor.name } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Venue ${input.outcome === 'confirmed' ? 'confirmed' : 'unavailable'} for the new date`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events,
        affectedType: 'venue_confirmation_task', affectedId: taskId, metadata: { outcome: input.outcome, note: input.note ?? '' },
      }, { prisma: tx, correlationId: `venue-confirmation:${taskId}`, actorId: actor.id });
      return this.mapVenueTask(updated);
    });
  }

  private mapVenueTask(row: { id: string; eventId: string; decision: string; newEventDate: Date | null; status: string; note: string; createdAt: Date; resolvedAt: Date | null; resolvedBy: string | null }): PrismVenueConfirmationTask {
    return {
      id: row.id, eventId: row.eventId, decision: row.decision as PrismVenueConfirmationTask['decision'],
      newEventDate: row.newEventDate?.toISOString().slice(0, 10) ?? null, status: row.status as PrismVenueConfirmationTask['status'],
      note: row.note, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolvedBy: row.resolvedBy,
    };
  }

  /** FR-96: what cancelling would cost, so PMCM sets the fee from the contract rather than typing it blind. */
  async cancellationSummary(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCancellationSummary> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'cancellation summary', eventId);
    return this.buildCancellationSummary(eventId, this.prisma);
  }

  private async buildCancellationSummary(eventId: string, db: PrismaService | Prisma.TransactionClient): Promise<PrismCancellationSummary> {
    const event = await db.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, inquiry: { select: { conformeSignedAt: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    const facts = await this.commercialFacts.getCancellationFacts(eventId, db);
    const conformeSigned = Boolean(event.inquiry?.conformeSignedAt);
    const bounds = cancellationFeeBounds(facts.contractAmount, conformeSigned);
    return { eventId, conformeSigned, ...facts, feeMinimum: bounds.minimum, feeMaximum: bounds.maximum, suggestedFee: bounds.minimum };
  }

  private async assertCancellationFee(eventId: string, input: EventDecisionInput, tx: Prisma.TransactionClient) {
    if (input.decision !== 'cancelled') return;
    const summary = await this.buildCancellationSummary(eventId, tx);
    if (input.cancellationFeeAmount < summary.feeMinimum || input.cancellationFeeAmount > summary.feeMaximum) {
      throw new BadRequestException(summary.conformeSigned
        ? `The cancellation fee must be between PHP ${summary.feeMinimum.toLocaleString('en-PH')} and PHP ${summary.feeMaximum.toLocaleString('en-PH')} (${CANCELLATION_FEE_POLICY.minPercent} to ${CANCELLATION_FEE_POLICY.maxPercent} percent of the contract)`
        : 'No cancellation fee applies before the conforme is signed');
    }
  }

  async list(eventId: string, actor: ResolvedEventOpsActor) {
    // Decision rows include commercial impact and actor details; event readers
    // such as clients and coordinators must not receive the full audit record.
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event decision history', eventId);
    await this.requireEvent(eventId);
    return this.prisma.opsEventDecision.findMany({ where: { eventId }, orderBy: { decidedAt: 'asc' } });
  }

  async decide(eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event cancellation or postponement', eventId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.idempotencyKey) {
          const replay = await tx.opsEventDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (replay) return this.requireMatchingReplay(replay, eventId, input, tx);
        }
        const event = await this.requireEvent(eventId, tx);
        const decisionId = `decision_${randomUUID()}`;
        // Consumption happens before any Operations or Commercial side effect, so a lost race stops the decision early.
        const freezeExceptionId = await this.consumeFreezeExceptionForDecision(tx, eventId, event.freezeStatus, input, decisionId);
        const priorState = this.validateEventState(event.status, event.eventDate, input);
        await this.assertCancellationFee(eventId, input, tx);
        const impacts = await this.loadImpacts(tx, eventId, input, event.eventDate, priorState.nextDate, actor);
        const fee = input.cancellationFeeAmount > 0 ? await this.cancellationFeeWriter.createConfirmedCancellationFeeSource(eventId, {
          amount: input.cancellationFeeAmount, reason: input.reason, idempotencyKey: `event-decision-fee:${decisionId}`,
        }, { id: actor.id ?? '', name: actor.name, role: actor.role, email: actor.email }, { prisma: tx, actorId: actor.id, correlationId: decisionId }) : null;
        const decision = await this.createDecision(tx, decisionId, eventId, input, actor, priorState, impacts.assignmentImpact, freezeExceptionId, fee?.id ?? null);
        await this.applyTransition(tx, eventId, input, impacts, priorState.nextDate);
        if (input.decision !== 'cancelled') {
          // FR-97: a moved date needs the venue re-confirmed; the downpayment carries over and no fee applies.
          await tx.opsVenueConfirmationTask.create({ data: {
            id: `vct_${randomUUID()}`, eventId, decisionId: decision.id, decision: input.decision,
            newEventDate: input.newEventDate ? new Date(`${input.newEventDate}T00:00:00.000Z`) : null,
          } });
        }
        await this.queueNotification(tx, event, eventId, input, decision.id);
        if (input.decision === 'cancelled' || input.supplierImpact === 'release_obligations') {
          // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each affected supplier receives a durable decision-scoped notice.
          for (const supplier of impacts.supplierRows) {
            const recipient = supplier.supplierEmail?.trim().toLowerCase();
            if (recipient) await writeNotification(this.notificationWriter, eventId, recipient, `PMCM released your supplier assignment for ${event.eventName} following ${input.decision}. Contact PMCM about contract and payment obligations.`, 'email', { idempotencyKey: `supplier-release:${decision.id}:${supplier.id}` }, { prisma: tx, correlationId: decision.id });
          }
        }
        await this.recordAudit(tx, eventId, input, actor, decision.id, priorState, impacts);
        return decision;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!input.idempotencyKey || !this.isIdempotencyRace(error)) throw error;
      const replay = await this.prisma.opsEventDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (!replay) throw error;
      return this.requireMatchingReplay(replay, eventId, input);
    }
  }

  private async requireMatchingReplay(
    replay: OpsEventDecision,
    eventId: string,
    input: EventDecisionInput,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (replay.eventId !== eventId) throw new BadRequestException('Decision idempotency key belongs to another event');
    const storedImpact = this.asJsonRecord(replay.financialImpact);
    const hasStoredNewEventDate = Object.prototype.hasOwnProperty.call(storedImpact, 'newEventDate');
    const targetDateMatches = hasStoredNewEventDate
      ? (storedImpact.newEventDate ?? null) === (input.newEventDate ?? null)
      : await this.legacyTargetDateMatches(replay, eventId, input, prisma);
    const samePayload = replay.decision === input.decision
      && replay.reason === input.reason
      && replay.supplierImpact === input.supplierImpact
      && storedImpact.cancellationFeeAmount === input.cancellationFeeAmount
      && storedImpact.depositTreatment === input.depositTreatment
      && (storedImpact.freezeExceptionId ?? null) === (input.freezeExceptionId ?? null)
      && targetDateMatches;
    if (!samePayload) throw new BadRequestException('Decision idempotency key was reused for different content');
    return replay;
  }

  private asJsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private async legacyTargetDateMatches(
    replay: OpsEventDecision,
    eventId: string,
    input: EventDecisionInput,
    prisma: Prisma.TransactionClient | PrismaService,
  ): Promise<boolean> {
    const storedReschedule = this.asJsonRecord(this.asJsonRecord(replay.assignmentImpact).reschedule);
    const storedTarget = storedReschedule.toDate;
    if (typeof storedTarget === 'string') {
      return Boolean(input.newEventDate && this.sameEventDate(input.newEventDate, storedTarget));
    }
    if (replay.decision === 'postponed' && input.newEventDate) {
      // Legacy records did not persist the requested date in financialImpact.
      // Use the persisted reschedule impact when present; otherwise current event
      // state is the only available proof and may reject a replay after later changes.
      const currentEvent = await prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventDate: true } });
      return Boolean(currentEvent && this.sameEventDate(input.newEventDate, currentEvent.eventDate));
    }
    return !input.newEventDate;
  }

  private sameEventDate(requestedDate: string, storedDate: Date | string): boolean {
    const requested = new Date(requestedDate);
    const stored = storedDate instanceof Date ? storedDate : new Date(storedDate);
    return !Number.isNaN(requested.getTime()) && !Number.isNaN(stored.getTime()) && requested.getTime() === stored.getTime();
  }

  private isIdempotencyRace(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) return false;
    if (error.code === 'P2002' || error.code === 'P2034') return true;
    // A serialization failure inside a raw query (for example an event row lock) surfaces as a Prisma raw-query
    // error that carries the PostgreSQL SQLSTATE 40001 in its metadata or message.
    const meta = 'meta' in error ? (error.meta as { code?: unknown } | undefined) : undefined;
    const message = 'message' in error ? String(error.message) : '';
    return meta?.code === '40001' || (error.code === 'P2010' && message.includes('40001'));
  }

  private validateEventState(status: string, eventDate: Date, input: EventDecisionInput) {
    if (['cancelled', 'archived'].includes(status)) throw new BadRequestException(`Event is already ${status}`);
    const nextDate = input.decision === 'postponed' && input.newEventDate ? new Date(input.newEventDate) : eventDate;
    if (Number.isNaN(nextDate.getTime())) throw new BadRequestException('New event date is invalid');
    return { status, eventDate: eventDate.toISOString(), nextDate };
  }

  private async loadImpacts(
    tx: Prisma.TransactionClient,
    eventId: string,
    input: EventDecisionInput,
    currentDate: Date,
    nextDate: Date,
    actor: ResolvedEventOpsActor,
  ) {
    const transactionContext = {
      prisma: tx,
      correlationId: `event-decision:${eventId}:${input.idempotencyKey ?? input.decision}`,
      actorId: actor.id,
    };
    const assignmentImpact = await this.staffingCommands.applyEventDecisionAssignments(
      eventId,
      input,
      currentDate.toISOString(),
      nextDate.toISOString(),
      actor,
      transactionContext,
    );
    const supplierRows = await this.supplierDecisionOwner.findEventDecisionSupplierImpact(eventId, transactionContext);
    return {
      supplierRows,
      assignmentImpact,
    };
  }

  /**
   * Scope-changing decisions on a frozen event need an approved freeze exception for this event.
   * Each approval is single-use: the conditional update only succeeds while it is unconsumed, so a
   * concurrent second decision that loses the row lock sees count 0 and is rejected.
   */
  private async consumeFreezeExceptionForDecision(
    tx: Prisma.TransactionClient,
    eventId: string,
    freezeStatus: string,
    input: EventDecisionInput,
    decisionId: string,
  ): Promise<string | null> {
    if (freezeStatus !== 'frozen') return null;
    if (!input.freezeExceptionId) throw new BadRequestException('Frozen events require an approved freeze exception before a cancellation or postponement is recorded');
    const consumed = await tx.opsEventFreezeException.updateMany({
      where: { id: input.freezeExceptionId, eventId, status: 'approved', consumedAt: null },
      data: { consumedAt: new Date(), consumedByDecisionId: decisionId },
    });
    if (consumed.count !== 1) throw new BadRequestException('Freeze exception is not an unused approval for this event');
    return input.freezeExceptionId;
  }

  private createDecision(tx: Prisma.TransactionClient, decisionId: string, eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor, priorState: { status: string; eventDate: string }, assignmentImpact: unknown, freezeExceptionId: string | null, billingSourceId: string | null) {
    return tx.opsEventDecision.create({ data: {
      id: decisionId, eventId, decision: input.decision, reason: input.reason,
      actorId: actor.id ?? actor.name, actorRole: actor.role, actorName: actor.name, actorEmail: actor.email ?? null,
      priorState: toPrismaJson(priorState), financialImpact: toPrismaJson({ cancellationFeeAmount: input.cancellationFeeAmount, depositTreatment: input.depositTreatment, newEventDate: input.newEventDate ?? null, freezeExceptionId, billingSourceId, status: billingSourceId ? 'approved_for_billing' : 'recorded_for_review' }),
      assignmentImpact: toPrismaJson(assignmentImpact), supplierImpact: input.supplierImpact, idempotencyKey: input.idempotencyKey ?? null,
    } });
  }

  private async applyTransition(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput, impacts: Awaited<ReturnType<EventDecisionService['loadImpacts']>>, nextDate: Date) {
    await tx.opsEvent.update({ where: { id: eventId }, data: { status: input.decision, eventDate: nextDate } });
    if (input.decision === 'cancelled' || input.supplierImpact === 'release_obligations') {
      await this.supplierDecisionOwner.releaseEventSupplierObligations(eventId, {
        prisma: tx,
        correlationId: `event-decision:${eventId}:${input.idempotencyKey ?? input.decision}`,
      });
    }
  }

  private async queueNotification(tx: Prisma.TransactionClient, event: Awaited<ReturnType<EventDecisionService['requireEvent']>>, eventId: string, input: EventDecisionInput, decisionId: string) {
    const recipient = event.inquiry?.email?.trim().toLowerCase();
    if (recipient && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) return writeNotification(this.notificationWriter, eventId, recipient, `Event ${event.eventName} decision recorded: ${input.decision}`, 'email', { idempotencyKey: `event-decision:${decisionId}` }, { prisma: tx, correlationId: decisionId });
    await tx.opsEventDecision.update({ where: { id: decisionId }, data: { notificationIntent: 'not_queued', notificationReason: 'missing_verified_recipient' } });
  }

  private recordAudit(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor, decisionId: string, priorState: { status: string; eventDate: string }, impacts: Awaited<ReturnType<EventDecisionService['loadImpacts']>>) {
    return writeAudit(this.auditWriter, eventId, actor.name, `Recorded event decision: ${input.decision}`, { actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event_decision', affectedId: decisionId, metadata: { priorState, reason: input.reason, financialImpact: { cancellationFeeAmount: input.cancellationFeeAmount, depositTreatment: input.depositTreatment }, assignmentImpact: impacts.assignmentImpact, supplierRows: impacts.supplierRows } }, { prisma: tx, correlationId: decisionId, actorId: actor.id });
  }

  private requireEvent(eventId: string, prisma: PrismaService | Prisma.TransactionClient = this.prisma) {
    return prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } }).then((event) => {
      if (!event) throw new NotFoundException('Event not found');
      return event;
    });
  }
}
