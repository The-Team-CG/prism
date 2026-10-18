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
import type { EventDecisionInput } from '@prism/types';
import { STAFFING_COMMANDS, type StaffingCommands } from '@prism/contexts/operations';
import { EVENT_DECISION_SUPPLIER_OWNER, type EventDecisionSupplierOwner } from '@prism/contexts/commercial';

@Injectable()
export class EventDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationWriter: NotificationOutboxWriter,
    @Inject(STAFFING_COMMANDS) private readonly staffingCommands: StaffingCommands,
    @Inject(EVENT_DECISION_SUPPLIER_OWNER) private readonly supplierDecisionOwner: EventDecisionSupplierOwner,
  ) {}

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
        const freezeExceptionId = await this.requireFreezeExceptionForDecision(tx, eventId, event.freezeStatus, input);
        const priorState = this.validateEventState(event.status, event.eventDate, input);
        const impacts = await this.loadImpacts(tx, eventId, input, event.eventDate, priorState.nextDate, actor);
        const decision = await this.createDecision(tx, eventId, input, actor, priorState, impacts.assignmentImpact, freezeExceptionId);
        await this.applyTransition(tx, eventId, input, impacts, priorState.nextDate);
        await this.queueNotification(tx, event, eventId, input, decision.id);
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
   * The exception is referenced from the decision's financial impact record so the approval trail stays linked.
   */
  private async requireFreezeExceptionForDecision(
    tx: Prisma.TransactionClient,
    eventId: string,
    freezeStatus: string,
    input: EventDecisionInput,
  ): Promise<string | null> {
    if (freezeStatus !== 'frozen') return null;
    if (!input.freezeExceptionId) throw new BadRequestException('Frozen events require an approved freeze exception before a cancellation or postponement is recorded');
    const exception = await tx.opsEventFreezeException.findFirst({ where: { id: input.freezeExceptionId, eventId, status: 'approved' }, select: { id: true } });
    if (!exception) throw new BadRequestException('Freeze exception is not approved for this event');
    return exception.id;
  }

  private createDecision(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor, priorState: { status: string; eventDate: string }, assignmentImpact: unknown, freezeExceptionId: string | null) {
    return tx.opsEventDecision.create({ data: {
      id: `decision_${randomUUID()}`, eventId, decision: input.decision, reason: input.reason,
      actorId: actor.id ?? actor.name, actorRole: actor.role, actorName: actor.name, actorEmail: actor.email ?? null,
      priorState: toPrismaJson(priorState), financialImpact: toPrismaJson({ cancellationFeeAmount: input.cancellationFeeAmount, depositTreatment: input.depositTreatment, newEventDate: input.newEventDate ?? null, freezeExceptionId, status: 'recorded_for_review' }),
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
