import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment, Prisma } from '@prisma/client';
import {
  COORDINATOR_ROLES,
  canonicalCoordinatorRole,
  coordinatorRoleSchema,
} from '@prism/types';
import type {
  CreateCoordinatorAssignmentInput,
  CoordinatorAssignmentAcknowledgementInput,
  EventDecisionInput,
  PrismCoordinatorAssignment,
  PrismCoordinatorAttendanceUpdateResult,
  PrismEventDecisionAssignmentImpact,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  WithdrawCoordinatorAssignmentInput,
} from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import { lockCoordinatorAssignmentDay, type PrismCommandContext, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, CoordinatorAttendanceStatus, INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES, isOpsConstantValue, OpsUserRole, WorkflowCommandService, WORKFLOW_COMMAND_LOG } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import type { StaffingCommands } from '../../contracts/staffing-commands.port';
import { COORDINATOR_RELIABILITY_WRITER } from '../../contracts/coordinator-reliability-writer.token';
import type { CoordinatorReliabilityWriter } from '../../contracts/coordinator-reliability-writer.port';
import { mapCoordinatorAssignment } from './coordinators.mappers';
import { resolveCoordinatorForActor } from './coordinator-actor-lookup';
import { CoordinatorSuggestionsService } from './coordinator-suggestions.service';
import { isoDate } from './staffing.utils';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReference,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import {
  COORDINATOR_ACCOUNT_ELIGIBILITY_READER,
  type CoordinatorAccountEligibilityReader,
} from '@prism/contexts/identity-access/coordinator-reference';

type CoordinatorConflict = OpsCoordinatorAssignment;

type CoordinatorAssignmentPlan = {
  event: OperationsEventReference;
  coordinator: OpsCoordinator;
  role: string;
  conflict: CoordinatorConflict | null;
  conflictEventName: string | null;
};

type EventDecisionAssignmentRow = Pick<OpsCoordinatorAssignment, 'id' | 'status' | 'coordinatorId' | 'coordinatorName'>;
type EventDecisionRescheduleConflict = NonNullable<PrismEventDecisionAssignmentImpact['reschedule']>['conflicts'][number];

@Injectable()
export class CoordinatorAssignmentCommandService implements StaffingCommands {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(WORKFLOW_COMMAND_LOG) private readonly workflowCommandService: WorkflowCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly coordinatorSuggestionsService: CoordinatorSuggestionsService,
    @Inject(COORDINATOR_RELIABILITY_WRITER) private readonly reliabilityWriter: CoordinatorReliabilityWriter,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(COORDINATOR_ACCOUNT_ELIGIBILITY_READER) private readonly coordinatorAccountEligibility: CoordinatorAccountEligibilityReader,
  ) {}

  private async resolveAssignmentPlan(
    eventId: string,
    input: CreateCoordinatorAssignmentInput,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    transactionContext?: PrismTransactionContext,
  ): Promise<CoordinatorAssignmentPlan> {
    const event = await this.requireEvent(eventId, prisma, transactionContext);
    if (event.archived || event.status === 'cancelled' || event.status === 'archived') {
      throw new BadRequestException('Event is not active for coordinator assignment changes');
    }
    const coordinator = await this.resolveCoordinator(input, prisma, transactionContext);
    if (input.role !== undefined && !coordinatorRoleSchema.safeParse(input.role).success) {
      throw new BadRequestException('Choose a role from the coordinator role catalog.');
    }
    const taggedRole = coordinator.roleTags
      .map(canonicalCoordinatorRole)
      .find((candidate): candidate is (typeof COORDINATOR_ROLES)[number] => candidate !== undefined);
    const role = input.role ?? taggedRole ?? 'General Coordinator';

    if (!coordinator.roleTags.some((tag) => canonicalCoordinatorRole(tag) === role)) {
      throw new BadRequestException(`${coordinator.name} is not tagged for ${role}`);
    }

    const eventDateEnd = new Date(event.eventDate.getTime() + 24 * 60 * 60 * 1000);
    const availabilityModel = 'opsCoordinatorAvailability' in prisma ? prisma.opsCoordinatorAvailability : undefined;
    const unavailable = availabilityModel
      ? await availabilityModel.findFirst({
          where: { coordinatorId: coordinator.id, startsAt: { lt: eventDateEnd }, endsAt: { gt: event.eventDate } },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        })
      : null;
    if (unavailable) {
      throw new BadRequestException({
        code: 'COORDINATOR_UNAVAILABLE',
        message: `${coordinator.name} is unavailable for ${isoDate(event.eventDate)}.`,
        availabilityId: unavailable.id,
        kind: unavailable.kind,
        note: unavailable.note,
      });
    }

    const conflict = await prisma.opsCoordinatorAssignment.findFirst({
      where: {
        coordinatorId: coordinator.id,
        eventDate: event.eventDate,
        eventId: { not: event.id },
        status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }) as CoordinatorConflict | null;
    const conflictEventName = conflict
      ? (await this.eventReferences.findOperationsEvent(conflict.eventId))?.eventName ?? null
      : null;

    if (conflict && !input.overrideConflict) {
      const sameRoleSuggestions = await this.coordinatorSuggestionsService.listForConflict(event, role, coordinator.id, prisma);
      throw new BadRequestException({
        code: 'COORDINATOR_DOUBLE_BOOKING',
        message: `${coordinator.name} is already assigned to ${conflictEventName ?? 'another event'} on this date.`,
        conflictEventId: conflict.eventId,
        conflictEventName,
        sameRoleSuggestions,
      });
    }

    return { event, coordinator, role, conflict, conflictEventName };
  }

  private buildAssignmentCreateData(
    eventId: string,
    plan: CoordinatorAssignmentPlan,
  ) {
    return {
      id: `coord_asg_${randomUUID()}`,
      eventId,
      coordinatorId: plan.coordinator.id,
      coordinatorName: plan.coordinator.name,
      role: plan.role,
      status: CoordinatorAssignmentStatus.PendingAcknowledgement,
      doubleBookingWarning: Boolean(plan.conflict),
      eventDate: plan.event.eventDate,
      conflictEventId: plan.conflict?.eventId ?? null,
      conflictEventName: plan.conflictEventName,
    };
  }

  async assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator assignment');

    let plan: Awaited<ReturnType<CoordinatorAssignmentCommandService['resolveAssignmentPlan']>> | null = null;
    const commandContext: PrismCommandContext = {
      actorId: actor.id ?? actor.name,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_assign_${eventId}_${input.coordinatorId ?? input.coordinatorName ?? input.role ?? 'unassigned'}`,
      idempotencyKey: `coord-assign:${eventId}:${input.coordinatorId ?? input.coordinatorName ?? input.role ?? 'unassigned'}`,
    };

    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<typeof mapCoordinatorAssignment>
    >({
      name: 'assign_coordinator',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.resolveAssignmentPlan(eventId, input);
      },
      validateStateInTransaction: async (transactionContext) => {
        await this.lockCoordinatorDate(transactionContext.prisma, input, eventId, transactionContext);
        plan = await this.resolveAssignmentPlan(eventId, input, transactionContext.prisma, transactionContext);
      },
      write: (transactionContext) => {
        if (!plan) throw new NotFoundException('Coordinator not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsCoordinatorAssignment.create({ data: this.buildAssignmentCreateData(eventId, plan) });
      },
      sideEffects: async (assignment, transactionContext) => {
        if (!plan) return;
        await Promise.all([
          this.auditWriter.write({
            eventId,
            actor: actor.name,
            action: `Assigned ${plan.coordinator.name} as ${plan.role}`,
            actionType: AuditActionType.Assign,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: assignment.id,
            affectedLabel: `${plan.coordinator.name} - ${plan.role}`,
            metadata: {
              coordinatorId: plan.coordinator.id,
              conflictEventId: plan.conflict?.eventId ?? null,
              conflictEventName: plan.conflictEventName,
            },
          }, transactionContext),
          this.notificationOutboxWriter.write({
            eventId,
            recipient: plan.coordinator.email,
            message: `Coordinator assignment issued: ${plan.event.eventName} (${plan.role})`,
            correlationId: commandContext.correlationId,
            idempotencyKey: `${commandContext.idempotencyKey}:email`,
          }, transactionContext),
          this.notificationOutboxWriter.write({
            eventId,
            recipient: assignment.coordinatorName,
            message: 'Coordinator assignment issued',
            channel: 'viber',
            correlationId: commandContext.correlationId,
            idempotencyKey: `${commandContext.idempotencyKey}:viber`,
          }, transactionContext),
        ]);
      },
      project: (assignment) => mapCoordinatorAssignment(assignment),
    });
  }

  async acknowledgeCoordinator(
    eventId: string,
    assignmentId: string,
    actor: ResolvedEventOpsActor,
    input: CoordinatorAssignmentAcknowledgementInput = { decision: 'acknowledged' },
  ) {
    // FLAGGED SCOPING DECISION (EP-02-S05 / AC8): acknowledge allows PmcmAdmin AND Coordinator,
    // not PmcmAdmin-only, because the real coordinator self-service flow (coordinator-view.tsx)
    // calls this endpoint for a coordinator to confirm their own assignment. Revisit only if
    // that flow changes.
    const actorId = actor.id ?? actor.name;
    const reason = input.reason ?? '';
    const targetStatus = input.decision === 'acknowledged'
      ? CoordinatorAssignmentStatus.Acknowledged
      : CoordinatorAssignmentStatus.Declined;
    const payloadHash = createHash('sha256').update(JSON.stringify({
      eventId,
      assignmentId,
      decision: input.decision,
      reason,
    })).digest('hex');

    const commandContext: PrismCommandContext = {
      actorId,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_ack_${eventId}_${assignmentId}`,
      idempotencyKey: `coord-ack:${eventId}:${assignmentId}`,
    };

    return this.workflowCommandService.execute<
      { assignment: OpsCoordinatorAssignment; changed: boolean },
      ReturnType<typeof mapCoordinatorAssignment>
    >({
      name: 'acknowledge_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash,
      validatePermission: async () => {
        await this.eventAccessPolicyService.requireActorRole(
          actor,
          [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator],
          'coordinator assignment acknowledgement',
          eventId,
        );
        await this.requireOwnedAssignment(eventId, assignmentId, actor);
      },
      validateState: async () => {
        await this.requireEvent(eventId);
        await this.requireOwnedAssignment(eventId, assignmentId, actor);
      },
      validateStateInTransaction: async ({ prisma }) => {
        await this.requireOwnedAssignment(eventId, assignmentId, actor, prisma);
      },
      write: async (transactionContext) => {
        const prisma = transactionContext?.prisma ?? this.prisma;
        const current = await this.requireOwnedAssignment(eventId, assignmentId, actor, prisma);
        if (
          current.status === targetStatus &&
          current.acknowledgedBy === actorId &&
          current.acknowledgementReason === reason
        ) {
          return { assignment: current, changed: false };
        }
        const changed = await prisma.opsCoordinatorAssignment.updateMany({
          where: {
            id: assignmentId,
            eventId,
            status: current.status,
            acknowledgedAt: current.acknowledgedAt,
            acknowledgedBy: current.acknowledgedBy,
            acknowledgementReason: current.acknowledgementReason,
          },
          data: {
            status: targetStatus,
            acknowledgedAt: new Date(),
            acknowledgedBy: actorId,
            acknowledgementReason: reason,
          },
        });
        if (changed.count !== 1) {
          const latest = await this.requireOwnedAssignment(eventId, assignmentId, actor, prisma);
          if (
            latest.status === targetStatus &&
            latest.acknowledgedBy === actorId &&
            latest.acknowledgementReason === reason
          ) {
            return { assignment: latest, changed: false };
          }
          throw new BadRequestException('Coordinator assignment changed before acknowledgement');
        }
        const updated = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
        if (!updated) throw new NotFoundException('Coordinator assignment not found');
        return { assignment: updated, changed: true };
      },
      sideEffects: async ({ assignment, changed }, transactionContext) => {
        if (!changed) return;
        const historyModel = 'opsCoordinatorAssignmentAcknowledgment' in (transactionContext?.prisma ?? this.prisma)
          ? (transactionContext?.prisma ?? this.prisma).opsCoordinatorAssignmentAcknowledgment
          : undefined;
        await Promise.all([
          historyModel?.create({
            data: {
              id: `coord_ack_${randomUUID()}`,
              assignmentId: assignment.id,
              state: input.decision,
              reason: input.reason ?? '',
              actor: actorId,
            },
          }),
          this.auditWriter.write({
            eventId,
            actor: actor.name,
            action: input.decision === 'acknowledged' ? 'Acknowledged coordinator assignment' : 'Declined coordinator assignment',
            actionType: input.decision === 'acknowledged' ? AuditActionType.Update : AuditActionType.Decline,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: assignment.id,
            affectedLabel: assignment.coordinatorName,
            metadata: { reason },
          }, transactionContext),
        ]);
      },
      project: ({ assignment }) => mapCoordinatorAssignment(assignment),
    });
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actor: ResolvedEventOpsActor,
    options: { allowAnotherAssignment?: boolean } = {},
  ): Promise<PrismCoordinatorAttendanceUpdateResult> {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'coordinator attendance',
      eventId,
    );
    const status = input.status.trim();
    if (!isOpsConstantValue(CoordinatorAttendanceStatus, status) || status === CoordinatorAttendanceStatus.Pending) {
      throw new BadRequestException('Unsupported coordinator attendance status');
    }
    const notes = input.notes?.trim() ?? '';
    const actorId = actor.id ?? actor.name;
    const commandContext: PrismCommandContext = {
      actorId,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_attendance_${eventId}_${assignmentId}_${randomUUID()}`,
    };

    return this.workflowCommandService.execute<
      { assignment: OpsCoordinatorAssignment; changed: boolean },
      PrismCoordinatorAttendanceUpdateResult
    >({
      name: 'update_coordinator_attendance',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireAttendanceAssignment(eventId, assignmentId, actor, options);
      },
      validateStateInTransaction: async ({ prisma }) => {
        await this.requireAttendanceAssignment(eventId, assignmentId, actor, options, prisma);
      },
      write: async (transactionContext) => {
        const prisma = transactionContext?.prisma ?? this.prisma;
        const current = await this.requireAttendanceAssignment(eventId, assignmentId, actor, options, prisma);
        if (current.attendanceStatus === status && (current.attendanceNotes ?? '') === notes) {
          return { assignment: current, changed: false };
        }

        const result = await prisma.opsCoordinatorAssignment.updateMany({
          where: {
            id: assignmentId,
            eventId,
            status: current.status,
            attendanceStatus: current.attendanceStatus,
            attendanceMarkedAt: current.attendanceMarkedAt,
          },
          data: { attendanceStatus: status, attendanceMarkedAt: new Date(), attendanceNotes: notes },
        });
        if (result.count !== 1) {
          const latest = await this.requireAttendanceAssignment(eventId, assignmentId, actor, options, prisma);
          if (latest.attendanceStatus === status && (latest.attendanceNotes ?? '') === notes) {
            return { assignment: latest, changed: false };
          }
          throw new BadRequestException('Coordinator attendance changed before this update');
        }
        const updated = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
        if (!updated) throw new NotFoundException('Coordinator assignment not found');
        return { assignment: updated, changed: true };
      },
      sideEffects: async ({ assignment, changed }, transactionContext) => {
        if (!changed) return;
        if (status === CoordinatorAttendanceStatus.Late || status === CoordinatorAttendanceStatus.Absent) {
          await this.reliabilityWriter.record({
            eventId,
            coordinatorId: assignment.coordinatorId ?? null,
            assignmentId: assignment.id,
            note: `${assignment.coordinatorName} marked ${status}${notes ? `: ${notes}` : ''}`,
            severity: status === CoordinatorAttendanceStatus.Absent ? 'critical' : 'warning',
          }, transactionContext);
        }
        await this.auditWriter.write({
          eventId,
          actor: actor.name,
          action: `Updated coordinator attendance: ${assignment.coordinatorName}`,
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'coordinator_assignment',
          affectedId: assignment.id,
          affectedLabel: `${assignment.coordinatorName} - ${assignment.role}`,
          metadata: { status, notes, markedBy: actor.name },
        }, transactionContext);
      },
      project: ({ assignment, changed }) => ({ assignment: mapCoordinatorAssignment(assignment), changed }),
    });
  }

  async applyEventDecisionAssignments(
    eventId: string,
    input: Pick<EventDecisionInput, 'decision' | 'supplierImpact' | 'reason' | 'newEventDate'>,
    currentEventDate: string,
    nextEventDate: string,
    actor: ResolvedEventOpsActor,
    context: PrismTransactionContext,
  ): Promise<PrismEventDecisionAssignmentImpact> {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'event decision assignment changes',
      eventId,
    );
    const prisma = context.prisma;
    const event = await this.requireEvent(eventId, prisma, context);
    if (event.archived || event.status === 'cancelled') throw new BadRequestException('Event is not active for assignment changes');

    const currentDate = new Date(currentEventDate);
    const targetDate = new Date(nextEventDate);
    if (Number.isNaN(currentDate.getTime()) || Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('Event assignment dates are invalid');
    }
    const requestedDate = input.decision === 'postponed' && input.newEventDate
      ? new Date(input.newEventDate)
      : currentDate;
    if (Number.isNaN(requestedDate.getTime()) || requestedDate.getTime() !== targetDate.getTime()) {
      throw new BadRequestException('Target assignment date does not match the event decision');
    }
    if (event.eventDate.getTime() !== currentDate.getTime()) {
      throw new BadRequestException('Event date changed before assignment updates were applied');
    }

    const assignmentRows = await prisma.opsCoordinatorAssignment.findMany({
      where: { eventId, status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] } },
      select: { id: true, status: true, coordinatorId: true, coordinatorName: true },
    });
    const release = input.decision === 'cancelled' || input.supplierImpact === 'release_obligations';
    const keptRows = release ? [] : assignmentRows;
    const reschedule = keptRows.length > 0 && targetDate.getTime() !== currentDate.getTime()
      ? await this.planEventDecisionReschedule(prisma, eventId, keptRows, targetDate)
      : null;

    if (release && assignmentRows.length > 0) {
      const released = await prisma.opsCoordinatorAssignment.updateMany({
        where: {
          eventId,
          id: { in: assignmentRows.map((row) => row.id) },
          status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] },
        },
        data: {
          status: CoordinatorAssignmentStatus.Cancelled,
          withdrawalReason: `Event ${input.decision}: ${input.reason}`,
          withdrawnAt: new Date(),
          withdrawnBy: actor.id ?? actor.name,
        },
      });
      if (released.count !== assignmentRows.length) throw new BadRequestException('Coordinator assignments changed during the event decision');
    }
    if (reschedule) {
      const moved = await prisma.opsCoordinatorAssignment.updateMany({
        where: {
          eventId,
          id: { in: reschedule.assignmentIds },
          status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] },
        },
        data: { eventDate: targetDate, doubleBookingWarning: false, conflictEventId: null, conflictEventName: null },
      });
      if (moved.count !== reschedule.assignmentIds.length) throw new BadRequestException('Coordinator assignments changed during the event decision');
      for (const conflict of reschedule.conflicts) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each event-scoped active assignment can need distinct persisted conflict metadata.
        if (conflict.reason !== 'double_booking') continue;
        const marked = await prisma.opsCoordinatorAssignment.updateMany({
          where: { id: conflict.assignmentId, eventId, status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] } },
          data: { doubleBookingWarning: true, conflictEventId: conflict.conflictEventId ?? null, conflictEventName: conflict.conflictEventName ?? null },
        });
        if (marked.count !== 1) throw new BadRequestException('Coordinator assignments changed during the event decision');
      }
    }

    return {
      releasedAssignmentIds: release ? assignmentRows.map((row) => row.id) : [],
      priorAssignments: assignmentRows.map(({ id, status, coordinatorId, coordinatorName }) => ({ id, status, coordinatorId, coordinatorName })),
      ...(reschedule ? { reschedule } : {}),
    };
  }

  async withdrawCoordinator(
    eventId: string,
    assignmentId: string,
    input: WithdrawCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator], 'coordinator withdrawal');

    const commandContext: PrismCommandContext = {
      actorId: actor.id ?? actor.name,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_withdraw_${eventId}_${assignmentId}`,
      idempotencyKey: `coord-withdraw:${eventId}:${assignmentId}`,
    };

    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<typeof mapCoordinatorAssignment>
    >({
      name: 'withdraw_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireAssignmentEventWritable(eventId, actor);
        const existing = await this.prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
        if (!existing) throw new NotFoundException('Coordinator assignment not found');
        if (actor.role === OpsUserRole.Coordinator) {
          await this.requireOwnedAssignment(eventId, assignmentId, actor);
          if (!input.reason?.trim()) throw new BadRequestException('Withdrawal reason is required');
        }
        if (existing.status === CoordinatorAssignmentStatus.Cancelled || existing.status === CoordinatorAssignmentStatus.Replaced) {
          throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
        }
      },
      validateStateInTransaction: async ({ prisma }) => {
        await this.requireAssignmentEventWritable(eventId, actor, prisma);
        if (actor.role === OpsUserRole.Coordinator) await this.requireOwnedAssignment(eventId, assignmentId, actor, prisma);
      },
      write: (transactionContext) => {
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsCoordinatorAssignment
          .update({
            where: { id: assignmentId },
            data: {
              status: CoordinatorAssignmentStatus.Cancelled,
              withdrawalReason: input.reason ?? '',
              withdrawnAt: new Date(),
              withdrawnBy: actor.id ?? actor.name,
            },
          })
          .catch(() => {
            throw new NotFoundException('Coordinator assignment not found');
          });
      },
      sideEffects: async (assignment, transactionContext) => {
        const reason = input.reason?.trim();
        await Promise.all([
          this.reliabilityWriter.record({
            eventId,
            coordinatorId: assignment.coordinatorId,
            assignmentId: assignment.id,
            note: `${assignment.coordinatorName} withdrew from ${assignment.role}${reason ? `: ${reason}` : ' (no reason provided)'}`,
            severity: 'warning',
          }, transactionContext),
          this.auditWriter.write({
            eventId,
            actor: actor.name,
            action: `Withdrew coordinator assignment for ${assignment.coordinatorName}`,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: assignment.id,
            affectedLabel: assignment.coordinatorName,
            metadata: { reason: input.reason ?? '' },
          }, transactionContext),
          this.notificationOutboxWriter.write({
            eventId,
            recipient: assignment.coordinatorName,
            message: `Your coordinator assignment for this event has been withdrawn${input.reason ? `: ${input.reason}` : '.'}`,
            correlationId: commandContext.correlationId,
            idempotencyKey: `${commandContext.idempotencyKey}:notify`,
          }, transactionContext),
        ]);
      },
      project: (assignment) => mapCoordinatorAssignment(assignment),
    });
  }

  async replaceCoordinator(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ) {
    // FLAGGED SCOPING DECISION (EP-02-S05 / AC8): replacement is PMCM/System-only by design,
    // there is no coordinator-facing replace UI today. Revisit if that changes.
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator replacement', eventId);

    let oldAssignment: OpsCoordinatorAssignment | null = null;
    let plan: Awaited<ReturnType<CoordinatorAssignmentCommandService['resolveAssignmentPlan']>> | null = null;
    const actorId = actor.id ?? actor.name;
    const payloadHash = createHash('sha256').update(JSON.stringify({
      eventId,
      assignmentId,
      replacementCoordinatorId: input.replacementCoordinatorId,
      replacementCoordinatorName: input.replacementCoordinatorName ?? null,
      role: input.replacementRole ?? input.role,
      reason: input.reason ?? '',
      overrideConflict: input.overrideConflict ?? false,
    })).digest('hex');
    const commandContext: PrismCommandContext = {
      actorId,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_replace_${eventId}_${assignmentId}:${payloadHash.slice(0, 12)}`,
      idempotencyKey: `coord-replace:${eventId}:${assignmentId}:${actorId}`,
    };

    return this.workflowCommandService.execute<
      { newAssignment: OpsCoordinatorAssignment; oldAssignment: OpsCoordinatorAssignment },
      {
        outgoing: ReturnType<typeof mapCoordinatorAssignment>;
        incoming: ReturnType<typeof mapCoordinatorAssignment>;
      }
    >({
      name: 'replace_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        const event = await this.requireEvent(eventId);
        if (event.archived) throw new BadRequestException('Archived coordinator events are read-only');
        const existing = await this.prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
        if (!existing) throw new NotFoundException('Coordinator assignment not found');
        if (existing.status === CoordinatorAssignmentStatus.Replaced ||
          (existing.status === CoordinatorAssignmentStatus.Cancelled && !existing.withdrawalReason)) {
          throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
        }
        await this.resolveAssignmentPlan(eventId, {
          coordinatorId: input.replacementCoordinatorId,
          coordinatorName: input.replacementCoordinatorName,
          role: input.replacementRole ?? input.role,
          overrideConflict: input.overrideConflict,
        });
      },
      validateStateInTransaction: async (transactionContext) => {
        const event = await this.requireEvent(eventId, transactionContext.prisma, transactionContext);
        if (event.archived) throw new BadRequestException('Archived coordinator events are read-only');
        oldAssignment = await transactionContext.prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
        if (!oldAssignment) throw new NotFoundException('Coordinator assignment not found');
        if (oldAssignment.status === CoordinatorAssignmentStatus.Replaced ||
          (oldAssignment.status === CoordinatorAssignmentStatus.Cancelled && !oldAssignment.withdrawalReason)) {
          throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
        }
        await this.lockCoordinatorDate(transactionContext.prisma, {
          coordinatorId: input.replacementCoordinatorId,
          coordinatorName: input.replacementCoordinatorName,
        }, eventId, transactionContext);
        plan = await this.resolveAssignmentPlan(eventId, {
          coordinatorId: input.replacementCoordinatorId,
          coordinatorName: input.replacementCoordinatorName,
          role: input.replacementRole ?? input.role,
          overrideConflict: input.overrideConflict,
        }, transactionContext.prisma, transactionContext);
      },
      write: async (transactionContext) => {
        if (!oldAssignment || !plan) throw new NotFoundException('Coordinator assignment not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        const newAssignment = await prisma.opsCoordinatorAssignment.create({
          data: this.buildAssignmentCreateData(eventId, plan),
        });
        const changed = await prisma.opsCoordinatorAssignment.updateMany({
          where: {
            id: assignmentId,
            eventId,
            status: oldAssignment.status,
          },
          data: {
            status: CoordinatorAssignmentStatus.Replaced,
            replacedAt: new Date(),
            replacedBy: actor.name,
            replacementReason: input.reason ?? '',
            replacedByAssignmentId: newAssignment.id,
          },
        });
        if (changed.count !== 1) throw new BadRequestException('Coordinator assignment changed before replacement');
        const updatedOld = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
        if (!updatedOld) throw new NotFoundException('Coordinator assignment not found');
        return { newAssignment, oldAssignment: updatedOld };
      },
      sideEffects: async ({ newAssignment, oldAssignment: updatedOld }, transactionContext) => {
        if (!plan) return;
        // Audit rows extend one hash chain, so a command's audit entries are written one after another.
        await this.auditWriter.write({
          eventId,
          actor: actor.name,
          action: `Replaced ${updatedOld.coordinatorName} with ${plan.coordinator.name}`,
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'coordinator_assignment',
          affectedId: updatedOld.id,
          affectedLabel: updatedOld.coordinatorName,
          metadata: { reason: input.reason ?? '', replacementAssignmentId: newAssignment.id },
        }, transactionContext);
        await this.auditWriter.write({
          eventId,
          actor: actor.name,
          action: `Assigned ${plan.coordinator.name} as ${plan.role} (replacement)`,
          actionType: AuditActionType.Assign,
          category: AuditCategory.Events,
          affectedType: 'coordinator_assignment',
          affectedId: newAssignment.id,
          affectedLabel: `${plan.coordinator.name} - ${plan.role}`,
          metadata: { replacedAssignmentId: updatedOld.id },
        }, transactionContext);
        await Promise.all([
          this.reliabilityWriter.record({
            eventId,
            coordinatorId: updatedOld.coordinatorId ?? null,
            assignmentId: updatedOld.id,
            note: `${updatedOld.coordinatorName} replaced for ${updatedOld.role}: ${input.reason ?? 'Assignment coverage changed'}`,
            severity: 'warning',
          }, transactionContext),
          this.notificationOutboxWriter.write({
            eventId,
            recipient: updatedOld.coordinatorName,
            message: `You have been replaced on this assignment${input.reason ? `: ${input.reason}` : '.'}`,
            correlationId: commandContext.correlationId,
            idempotencyKey: `${commandContext.idempotencyKey}:outgoing`,
          }, transactionContext),
          this.notificationOutboxWriter.write({
            eventId,
            recipient: plan.coordinator.email,
            message: `Coordinator assignment issued (replacement): ${plan.role}`,
            correlationId: commandContext.correlationId,
            idempotencyKey: `${commandContext.idempotencyKey}:incoming`,
          }, transactionContext),
        ]);
      },
      project: ({ newAssignment, oldAssignment: updatedOld }) => ({
        outgoing: mapCoordinatorAssignment(updatedOld),
        incoming: mapCoordinatorAssignment(newAssignment),
      }),
    });
  }

  private async resolveCoordinator(
    input: CreateCoordinatorAssignmentInput,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    transactionContext?: PrismTransactionContext,
  ) {
    const candidate = input.coordinatorId
      ? await prisma.opsCoordinator.findUnique({ where: { id: input.coordinatorId } })
      : await prisma.opsCoordinator.findFirst({
          where: { name: input.coordinatorName ?? '', active: true },
        });
    if (!candidate) throw new NotFoundException('Coordinator not found');

    if (transactionContext) {
      // QUERY_AUDIT_RAW_SQL: serialize current Operations coordinator eligibility with assignment writes.
      await transactionContext.prisma.$queryRaw`SELECT id FROM operations.coordinators WHERE id = ${candidate.id} FOR UPDATE`;
    }
    const coordinator = transactionContext
      ? await prisma.opsCoordinator.findUnique({ where: { id: candidate.id } })
      : candidate;
    if (!coordinator) throw new NotFoundException('Coordinator not found');
    if (!coordinator.active) throw new BadRequestException('Coordinator is inactive');
    if (
      coordinator.userId &&
      !(await this.coordinatorAccountEligibility.isCoordinatorAccountEligible(coordinator.userId, transactionContext))
    ) {
      throw new BadRequestException('Coordinator account is not currently eligible for assignment');
    }
    return coordinator as OpsCoordinator;
  }
  private async requireEvent(
    eventId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    transactionContext?: PrismTransactionContext,
  ): Promise<OperationsEventReference> {
    const context = transactionContext ?? (prisma === this.prisma ? undefined : {
      prisma: prisma as Prisma.TransactionClient,
      correlationId: `operations_event_reference:${eventId}`,
    });
    const event = await this.eventReferences.findOperationsEvent(eventId, context);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async lockCoordinatorDate(
    prisma: Prisma.TransactionClient,
    input: {
      coordinatorId?: string;
      coordinatorName?: string;
      replacementCoordinatorId?: string;
      replacementCoordinatorName?: string;
    },
    eventId: string,
    transactionContext?: PrismTransactionContext,
  ) {
    const coordinatorId = input.coordinatorId ?? input.replacementCoordinatorId;
    const coordinatorName = input.coordinatorName ?? input.replacementCoordinatorName;
    const coordinator = coordinatorId
      ? await prisma.opsCoordinator.findUnique({ where: { id: coordinatorId }, select: { id: true } })
      : coordinatorName
        ? await prisma.opsCoordinator.findFirst({ where: { name: coordinatorName }, select: { id: true } })
        : null;
    if (!coordinator) return;
    const event = await this.requireEvent(eventId, prisma, transactionContext).catch((error) => {
      if (error instanceof NotFoundException) return null;
      throw error;
    });
    if (!event?.eventDate) return;
    await lockCoordinatorAssignmentDay(prisma, coordinator.id, event.eventDate);
  }

  private async requireAttendanceAssignment(
    eventId: string,
    assignmentId: string,
    actor: ResolvedEventOpsActor,
    options: { allowAnotherAssignment?: boolean },
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const event = await this.requireEvent(eventId, prisma);
    if (event.archived) throw new BadRequestException('Archived coordinator events are read-only');
    const assignment = await prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
    if (!assignment) throw new NotFoundException('Coordinator assignment not found');
    if ((INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)) {
      throw new BadRequestException('Coordinator assignment is no longer active');
    }
    if (actor.role === OpsUserRole.Coordinator) {
      if (options.allowAnotherAssignment) {
        await this.requireAssignmentEventWritable(eventId, actor, prisma);
      } else {
        await this.requireOwnedAssignment(eventId, assignmentId, actor, prisma);
      }
    }
    return assignment;
  }

  private async planEventDecisionReschedule(
    prisma: Prisma.TransactionClient,
    eventId: string,
    rows: EventDecisionAssignmentRow[],
    nextDate: Date,
  ): Promise<NonNullable<PrismEventDecisionAssignmentImpact['reschedule']>> {
    const coordinatorIds = [...new Set(rows.flatMap((row) => (row.coordinatorId ? [row.coordinatorId] : [])))].sort();
    for (const coordinatorId of coordinatorIds) await lockCoordinatorAssignmentDay(prisma, coordinatorId, nextDate);
    const nextDateEnd = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
    const [bookings, blocks] = coordinatorIds.length
      ? await Promise.all([
          prisma.opsCoordinatorAssignment.findMany({
            where: {
              coordinatorId: { in: coordinatorIds },
              eventDate: nextDate,
              eventId: { not: eventId },
              status: { notIn: [...INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES] },
            },
            select: { coordinatorId: true, eventId: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
          prisma.opsCoordinatorAvailability.findMany({
            where: { coordinatorId: { in: coordinatorIds }, startsAt: { lt: nextDateEnd }, endsAt: { gt: nextDate } },
            select: { coordinatorId: true },
          }),
        ])
      : [[], []];
    const eventNames = new Map((await this.eventReferences.findOperationsEvents(
      [...new Set(bookings.map((booking) => booking.eventId))],
    )).map((item) => [item.id, item.eventName]));
    const conflicts = rows.flatMap<EventDecisionRescheduleConflict>((row) => {
      const booking = bookings.find((item) => item.coordinatorId === row.coordinatorId);
      if (booking) return [{ assignmentId: row.id, coordinatorName: row.coordinatorName, reason: 'double_booking', conflictEventId: booking.eventId, conflictEventName: eventNames.get(booking.eventId) }];
      if (blocks.some((item) => item.coordinatorId === row.coordinatorId)) return [{ assignmentId: row.id, coordinatorName: row.coordinatorName, reason: 'unavailable' }];
      return [];
    });
    return { toDate: nextDate.toISOString(), assignmentIds: rows.map((row) => row.id), conflicts };
  }

  private async requireAssignmentEventWritable(
    eventId: string,
    actor: ResolvedEventOpsActor,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const event = await this.requireEvent(eventId, prisma);
    if (event.archived) {
      if (actor.role === OpsUserRole.Coordinator) throw new ForbiddenException('Archived coordinator events are read-only');
      throw new BadRequestException('Archived coordinator events are read-only');
    }
    if (event.status === 'cancelled' || event.status === 'archived') {
      throw new BadRequestException('Event is not active for coordinator assignment changes');
    }
  }

  // PA-276: acknowledgeCoordinator previously updated by assignmentId alone, letting any
  // authenticated Coordinator acknowledge any assignment regardless of who it belonged to
  // or which event it was scoped to. This closes both gaps: the assignment must belong to
  // the route's eventId, and a Coordinator actor must own the assignment being acknowledged.
  private async requireOwnedAssignment(
    eventId: string,
    assignmentId: string,
    actor: ResolvedEventOpsActor,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<OpsCoordinatorAssignment> {
    const assignment = await prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId } });
    if (!assignment || assignment.eventId !== eventId) {
      throw new NotFoundException('Coordinator assignment not found');
    }

    await this.requireAssignmentEventWritable(eventId, actor, prisma);

    if (actor.role === OpsUserRole.Coordinator) {
      const coordinator = await resolveCoordinatorForActor(prisma, actor);
      const owns =
        this.eventAccessPolicyService.sameText(assignment.coordinatorId, coordinator.id) ||
        this.eventAccessPolicyService.sameText(assignment.coordinatorName, coordinator.name);

      if (!owns) {
        await this.eventAccessPolicyService.recordForbiddenAccess(
          actor,
          'coordinator assignment acknowledgement',
          eventId,
        );
        throw new ForbiddenException("Coordinator cannot acknowledge another coordinator's assignment");
      }
    }

    if (
      assignment.status === CoordinatorAssignmentStatus.Cancelled ||
      assignment.status === CoordinatorAssignmentStatus.Replaced
    ) {
      throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
    }
    return assignment;
  }
}
