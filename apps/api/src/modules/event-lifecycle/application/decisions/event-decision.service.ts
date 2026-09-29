import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import {
  AuditActionType,
  AuditCategory,
  CoordinatorAssignmentStatus,
  INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES,
  OpsUserRole,
} from '@prism/kernel/event-core';
import { lockCoordinatorAssignmentDay } from '@prism/kernel/shared-kernel';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import type { EventDecisionInput } from '@prism/types';

type AssignmentImpactRow = { id: string; status: string; coordinatorId: string | null; coordinatorName: string };

/** A kept coordinator whose new event date needs PMCM attention. */
type RescheduleConflict = {
  assignmentId: string;
  coordinatorName: string;
  reason: 'double_booking' | 'unavailable';
  conflictEventId?: string;
  conflictEventName?: string;
};

/** Coordinators that stay on the event and follow it to its new date. */
type RescheduleImpact = { toDate: string; assignmentIds: string[]; conflicts: RescheduleConflict[] };

@Injectable()
export class EventDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationWriter: NotificationOutboxWriter,
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
      const impacts = await this.loadImpacts(tx, eventId, input, event.eventDate, priorState.nextDate);
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

  private async loadImpacts(tx: Prisma.TransactionClient, eventId: string, input: EventDecisionInput, currentDate: Date, nextDate: Date) {
    const [assignmentRows, supplierRows] = await Promise.all([
      tx.opsCoordinatorAssignment.findMany({
        where: { eventId, status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] } },
        select: { id: true, status: true, coordinatorId: true, coordinatorName: true },
      }),
      tx.opsSupplierQuoteRequest.findMany({ where: { eventId, assignmentStatus: { not: 'withdrawn' } }, select: { id: true, supplierName: true, assignmentStatus: true } }),
    ]);
    const release = input.decision === 'cancelled' || input.supplierImpact === 'release_obligations';
    const keptRows = release ? [] : assignmentRows;
    const reschedule = keptRows.length && nextDate.getTime() !== currentDate.getTime()
      ? await this.planReschedule(tx, eventId, keptRows, nextDate)
      : null;
    return {
      assignmentRows,
      supplierRows,
      assignmentImpact: {
        releasedAssignmentIds: release ? assignmentRows.map((row) => row.id) : [],
        priorAssignments: assignmentRows,
        ...(reschedule ? { reschedule } : {}),
      },
    };
  }

  /**
   * Kept coordinators follow the event to its new date. The move itself is not
   * blocked, because PMCM has already decided to postpone, but each coordinator
   * is re-checked for a booking or declared unavailability on that date so the
   * clash is flagged instead of silently double-booking someone.
   */
  private async planReschedule(tx: Prisma.TransactionClient, eventId: string, rows: AssignmentImpactRow[], nextDate: Date): Promise<RescheduleImpact> {
    const coordinatorIds = [...new Set(rows.flatMap((row) => (row.coordinatorId ? [row.coordinatorId] : [])))].sort();
    // The booking and replacement flows take this per coordinator/day lock; a fixed order keeps two decisions from deadlocking.
    for (const coordinatorId of coordinatorIds) await lockCoordinatorAssignmentDay(tx, coordinatorId, nextDate);
    const [bookings, blocks] = coordinatorIds.length
      ? await Promise.all([
          tx.opsCoordinatorAssignment.findMany({
            where: {
              coordinatorId: { in: coordinatorIds },
              eventDate: nextDate,
              eventId: { not: eventId },
              status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] },
            },
            select: { coordinatorId: true, eventId: true, event: { select: { eventName: true } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
          tx.opsCoordinatorAvailability.findMany({
            where: { coordinatorId: { in: coordinatorIds }, startsAt: { lte: nextDate }, endsAt: { gt: nextDate } },
            select: { coordinatorId: true },
          }),
        ])
      : [[], []];
    const conflicts = rows.flatMap((row): RescheduleConflict[] => {
      const booking = bookings.find((item) => item.coordinatorId === row.coordinatorId);
      if (booking) return [{ assignmentId: row.id, coordinatorName: row.coordinatorName, reason: 'double_booking', conflictEventId: booking.eventId, conflictEventName: booking.event.eventName }];
      if (blocks.some((item) => item.coordinatorId === row.coordinatorId)) return [{ assignmentId: row.id, coordinatorName: row.coordinatorName, reason: 'unavailable' }];
      return [];
    });
    return { toDate: nextDate.toISOString(), assignmentIds: rows.map((row) => row.id), conflicts };
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
    const { releasedAssignmentIds, reschedule } = impacts.assignmentImpact;
    if (releasedAssignmentIds.length) {
      // Cancelled is the state every staffing check treats as inactive; any other value would leave the coordinator booked.
      await tx.opsCoordinatorAssignment.updateMany({ where: { id: { in: releasedAssignmentIds } }, data: { status: CoordinatorAssignmentStatus.Cancelled, withdrawalReason: `Event ${input.decision}: ${input.reason}`, withdrawnAt: new Date(), withdrawnBy: actor.id ?? actor.name } });
    }
    if (reschedule) await this.moveKeptAssignments(tx, reschedule, nextDate);
    if (input.decision === 'cancelled' || input.supplierImpact === 'release_obligations') await tx.opsSupplierQuoteRequest.updateMany({ where: { id: { in: impacts.supplierRows.map((row) => row.id) } }, data: { assignmentStatus: 'withdrawn' } });
  }

  private async moveKeptAssignments(tx: Prisma.TransactionClient, reschedule: RescheduleImpact, nextDate: Date) {
    await tx.opsCoordinatorAssignment.updateMany({
      where: { id: { in: reschedule.assignmentIds } },
      data: { eventDate: nextDate, doubleBookingWarning: false, conflictEventId: null, conflictEventName: null },
    });
    for (const conflict of reschedule.conflicts) {
      if (conflict.reason !== 'double_booking') continue;
      await tx.opsCoordinatorAssignment.update({
        where: { id: conflict.assignmentId },
        data: { doubleBookingWarning: true, conflictEventId: conflict.conflictEventId ?? null, conflictEventName: conflict.conflictEventName ?? null },
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
