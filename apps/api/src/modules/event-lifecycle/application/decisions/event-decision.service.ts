import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type { EventDecisionInput } from '@prism/types';

@Injectable()
export class EventDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    private readonly auditWriter: AuditWriter,
    private readonly notificationWriter: NotificationOutboxWriter,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor) {
    const event = await this.requireEvent(eventId);
    await this.access.requireCanReadEvent(actor, event, 'event decision history');
    return this.prisma.opsEventDecision.findMany({ where: { eventId }, orderBy: { decidedAt: 'asc' } });
  }

  async decide(eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event cancellation or postponement', eventId);
    return this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const replay = await tx.opsEventDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.eventId !== eventId) throw new BadRequestException('Decision idempotency key belongs to another event');
          return replay;
        }
      }
      const event = await this.requireEvent(eventId, tx);
      const priorState = this.validateEventState(event.status, event.eventDate, input);
      const impacts = await this.loadImpacts(tx, eventId, input);
      const decision = await this.createDecision(tx, eventId, input, actor, priorState, impacts.assignmentImpact);
      await this.applyTransition(tx, eventId, input, actor, impacts, priorState.nextDate);
      await this.queueNotification(tx, event, eventId, input, decision.id);
      await this.recordAudit(tx, eventId, input, actor, decision.id, priorState, impacts);
      return decision;
    }, { isolationLevel: 'Serializable' });
  }

  private validateEventState(status: string, eventDate: Date, input: EventDecisionInput) {
    if (['cancelled', 'archived'].includes(status)) throw new BadRequestException(`Event is already ${status}`);
    const nextDate = input.decision === 'postponed' && input.newEventDate ? new Date(input.newEventDate) : eventDate;
    if (Number.isNaN(nextDate.getTime())) throw new BadRequestException('New event date is invalid');
    return { status, eventDate: eventDate.toISOString(), nextDate };
  }

  private async loadImpacts(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput) {
    const [assignmentRows, supplierRows] = await Promise.all([
      tx.opsCoordinatorAssignment.findMany({ where: { eventId, status: { notIn: ['withdrawn', 'replaced'] } }, select: { id: true, status: true, coordinatorName: true } }),
      tx.opsSupplierQuoteRequest.findMany({ where: { eventId, assignmentStatus: { not: 'withdrawn' } }, select: { id: true, supplierName: true, assignmentStatus: true } }),
    ]);
    const release = input.decision === 'cancelled' || input.supplierImpact === 'release_obligations';
    return { assignmentRows, supplierRows, assignmentImpact: { releasedAssignmentIds: release ? assignmentRows.map((row) => row.id) : [], priorAssignments: assignmentRows } };
  }

  private createDecision(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor, priorState: { status: string; eventDate: string }, assignmentImpact: unknown) {
    return tx.opsEventDecision.create({ data: {
      id: `decision_${randomUUID()}`, eventId, decision: input.decision, reason: input.reason,
      actorId: actor.id ?? actor.name, actorRole: actor.role, actorName: actor.name, actorEmail: actor.email ?? null,
      priorState: toPrismaJson(priorState), financialImpact: toPrismaJson({ cancellationFeeAmount: input.cancellationFeeAmount, depositTreatment: input.depositTreatment, status: 'recorded_for_review' }),
      assignmentImpact: toPrismaJson(assignmentImpact), supplierImpact: input.supplierImpact, idempotencyKey: input.idempotencyKey ?? null,
    } });
  }

  private async applyTransition(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput, actor: ResolvedEventOpsActor, impacts: Awaited<ReturnType<EventDecisionService['loadImpacts']>>, nextDate: Date) {
    await tx.opsEvent.update({ where: { id: eventId }, data: { status: input.decision, eventDate: nextDate } });
    if (impacts.assignmentImpact.releasedAssignmentIds.length) await tx.opsCoordinatorAssignment.updateMany({ where: { id: { in: impacts.assignmentImpact.releasedAssignmentIds } }, data: { status: 'withdrawn', withdrawalReason: `Event ${input.decision}: ${input.reason}`, withdrawnAt: new Date(), withdrawnBy: actor.id ?? actor.name } });
    if (input.decision === 'cancelled' || input.supplierImpact === 'release_obligations') await tx.opsSupplierQuoteRequest.updateMany({ where: { id: { in: impacts.supplierRows.map((row) => row.id) } }, data: { assignmentStatus: 'withdrawn' } });
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
