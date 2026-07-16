import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment, OpsEvent } from '@prisma/client';
import { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import type { PrismCommandContext } from '../../../../core/shared-kernel/src';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, OpsUserRole, WorkflowCommandService, WORKFLOW_COMMAND_LOG } from '@prism/modules/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/modules/access-control';
import { AUDIT_WRITER, type AuditWriter } from '@prism/modules/trust-ops';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter } from '@prism/modules/notification-ops';

export type CreateCoordinatorAssignmentInput = {
  coordinatorId?: string;
  coordinatorName?: string;
  role?: string;
  overrideConflict?: boolean;
};

export type WithdrawCoordinatorAssignmentInput = {
  reason?: string;
};

export type ReplaceCoordinatorAssignmentInput = {
  replacementCoordinatorId?: string;
  replacementCoordinatorName?: string;
  replacementRole?: string;
  reason?: string;
  overrideConflict?: boolean;
};

type CoordinatorConflict = OpsCoordinatorAssignment & {
  event: {
    eventName: string;
  };
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

@Injectable()
export class CoordinatorsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(WORKFLOW_COMMAND_LOG) private readonly workflowCommandService: WorkflowCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  async listCoordinators() {
    const coordinators = await this.prisma.opsCoordinator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return coordinators.map((coordinator: OpsCoordinator) => this.mapCoordinator(coordinator));
  }


  async listAssignmentsForCoordinator(coordinatorId?: string | null, coordinatorName?: string | null) {
    const [byId, byName] = await Promise.all([
      coordinatorId
        ? this.prisma.opsCoordinatorAssignment.findMany({
            where: { coordinatorId },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as OpsCoordinatorAssignment[]),
      coordinatorName
        ? this.prisma.opsCoordinatorAssignment.findMany({
            where: { coordinatorName },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as OpsCoordinatorAssignment[]),
    ]);

    return [...byId, ...byName].filter(
      (assignment, index, assignments) => assignments.findIndex((item) => item.id === assignment.id) === index,
    );
  }

  listAssignmentsForEvent(eventId: string) {
    return this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } });
  }

  async resolveCoordinatorForActor(actor: { coordinatorId?: string | null; email?: string | null; name?: string | null }) {
    const coordinators = await this.prisma.opsCoordinator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    const coordinator = coordinators.find(
      (item: OpsCoordinator) =>
        this.sameText(actor.coordinatorId, item.id) ||
        this.sameText(actor.email, item.email) ||
        this.sameText(actor.name, item.name),
    );
    if (!coordinator) throw new NotFoundException('Coordinator profile not found for actor');
    return coordinator as OpsCoordinator;
  }

  async findAssignmentForEventActor(
    eventId: string,
    actor: { coordinatorId?: string | null; email?: string | null; name?: string | null },
  ) {
    const coordinator = await this.resolveCoordinatorForActor(actor);
    const assignments = await this.listAssignmentsForEvent(eventId);
    return (
      assignments.find(
        (item) =>
          this.sameText(item.coordinatorId, coordinator.id) ||
          this.sameText(item.coordinatorName, coordinator.name) ||
          this.sameText(item.coordinatorName, actor.name),
      ) ?? null
    );
  }

  private async resolveAssignmentPlan(
    eventId: string,
    input: CreateCoordinatorAssignmentInput,
  ): Promise<{ event: OpsEvent; coordinator: OpsCoordinator; role: string; conflict: CoordinatorConflict | null }> {
    const event = await this.requireEvent(eventId);
    const coordinator = await this.resolveCoordinator(input);
    const role = input.role || coordinator.roleTags[0] || 'General Coordinator';

    if (!coordinator.roleTags.includes(role)) {
      throw new BadRequestException(`${coordinator.name} is not tagged for ${role}`);
    }

    const conflict = (await this.prisma.opsCoordinatorAssignment.findFirst({
      where: {
        coordinatorId: coordinator.id,
        eventDate: event.eventDate,
        eventId: { not: event.id },
        status: { not: CoordinatorAssignmentStatus.Cancelled },
      },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    })) as CoordinatorConflict | null;

    if (conflict && !input.overrideConflict) {
      throw new BadRequestException(
        `${coordinator.name} is already assigned to ${conflict.event.eventName} on this date.`,
      );
    }

    return { event, coordinator, role, conflict };
  }

  private buildAssignmentCreateData(
    eventId: string,
    plan: { event: OpsEvent; coordinator: OpsCoordinator; role: string; conflict: CoordinatorConflict | null },
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
      conflictEventName: plan.conflict?.event.eventName ?? null,
    };
  }

  async assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator assignment');

    let plan: Awaited<ReturnType<CoordinatorsService['resolveAssignmentPlan']>> | null = null;
    const commandContext: PrismCommandContext = {
      actorId: actor.id ?? actor.name,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_assign_${eventId}_${input.coordinatorId ?? input.coordinatorName ?? input.role ?? 'unassigned'}`,
      idempotencyKey: `coord-assign:${eventId}:${input.coordinatorId ?? input.coordinatorName ?? input.role ?? 'unassigned'}`,
    };

    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<CoordinatorsService['mapCoordinatorAssignment']>
    >({
      name: 'assign_coordinator',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        plan = await this.resolveAssignmentPlan(eventId, input);
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
              conflictEventName: plan.conflict?.event.eventName ?? null,
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
      project: (assignment) => this.mapCoordinatorAssignment(assignment),
    });
  }

  async acknowledgeCoordinator(eventId: string, assignmentId: string, actor: ResolvedEventOpsActor) {
    // FLAGGED SCOPING DECISION (EP-02-S05 / AC8): acknowledge allows PmcmAdmin AND Coordinator,
    // not PmcmAdmin-only, because the real coordinator self-service flow (coordinator-view.tsx)
    // calls this endpoint for a coordinator to confirm their own assignment. Revisit only if
    // that flow changes.
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator],
      'coordinator assignment acknowledgement',
    );

    const commandContext: PrismCommandContext = {
      actorId: actor.id ?? actor.name,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_ack_${eventId}_${assignmentId}`,
      idempotencyKey: `coord-ack:${eventId}:${assignmentId}`,
    };

    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<CoordinatorsService['mapCoordinatorAssignment']>
    >({
      name: 'acknowledge_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
      },
      write: (transactionContext) => {
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsCoordinatorAssignment
          .update({
            where: { id: assignmentId },
            data: { status: CoordinatorAssignmentStatus.Acknowledged, acknowledgedAt: new Date() },
          })
          .catch(() => {
            throw new NotFoundException('Coordinator assignment not found');
          });
      },
      sideEffects: async (assignment, transactionContext) => {
        await this.auditWriter.write({
          eventId,
          actor: actor.name,
          action: 'Acknowledged coordinator assignment',
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'coordinator_assignment',
          affectedId: assignment.id,
          affectedLabel: assignment.coordinatorName,
        }, transactionContext);
      },
      project: (assignment) => this.mapCoordinatorAssignment(assignment),
    });
  }

  async withdrawCoordinator(
    eventId: string,
    assignmentId: string,
    input: WithdrawCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ) {
    // FLAGGED SCOPING DECISION (EP-02-S05 / AC8): withdraw is PmcmAdmin-only by design,
    // there is no coordinator-facing withdraw UI today. Revisit if that changes.
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator withdrawal');

    const commandContext: PrismCommandContext = {
      actorId: actor.id ?? actor.name,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_withdraw_${eventId}_${assignmentId}`,
      idempotencyKey: `coord-withdraw:${eventId}:${assignmentId}`,
    };

    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<CoordinatorsService['mapCoordinatorAssignment']>
    >({
      name: 'withdraw_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const existing = await this.prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
        if (!existing) throw new NotFoundException('Coordinator assignment not found');
        if (
          existing.status === CoordinatorAssignmentStatus.Cancelled ||
          existing.status === CoordinatorAssignmentStatus.Replaced
        ) {
          throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
        }
      },
      write: (transactionContext) => {
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsCoordinatorAssignment
          .update({
            where: { id: assignmentId },
            data: { status: CoordinatorAssignmentStatus.Cancelled },
          })
          .catch(() => {
            throw new NotFoundException('Coordinator assignment not found');
          });
      },
      sideEffects: async (assignment, transactionContext) => {
        await Promise.all([
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
      project: (assignment) => this.mapCoordinatorAssignment(assignment),
    });
  }

  async replaceCoordinator(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ) {
    // FLAGGED SCOPING DECISION (EP-02-S05 / AC8): replace is PmcmAdmin-only by design,
    // there is no coordinator-facing replace UI today. Revisit if that changes.
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'coordinator replacement');

    let oldAssignment: OpsCoordinatorAssignment | null = null;
    let plan: Awaited<ReturnType<CoordinatorsService['resolveAssignmentPlan']>> | null = null;
    const commandContext: PrismCommandContext = {
      actorId: actor.id ?? actor.name,
      actorRole: actor.role,
      eventId,
      correlationId: `coord_replace_${eventId}_${assignmentId}`,
      idempotencyKey: `coord-replace:${eventId}:${assignmentId}`,
    };

    return this.workflowCommandService.execute<
      { newAssignment: OpsCoordinatorAssignment; oldAssignment: OpsCoordinatorAssignment },
      {
        outgoing: ReturnType<CoordinatorsService['mapCoordinatorAssignment']>;
        incoming: ReturnType<CoordinatorsService['mapCoordinatorAssignment']>;
      }
    >({
      name: 'replace_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        oldAssignment = await this.prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
        if (!oldAssignment) throw new NotFoundException('Coordinator assignment not found');
        if (
          oldAssignment.status === CoordinatorAssignmentStatus.Cancelled ||
          oldAssignment.status === CoordinatorAssignmentStatus.Replaced
        ) {
          throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
        }
        plan = await this.resolveAssignmentPlan(eventId, {
          coordinatorId: input.replacementCoordinatorId,
          coordinatorName: input.replacementCoordinatorName,
          role: input.replacementRole,
          overrideConflict: input.overrideConflict,
        });
      },
      write: async (transactionContext) => {
        if (!oldAssignment || !plan) throw new NotFoundException('Coordinator assignment not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        const newAssignment = await prisma.opsCoordinatorAssignment.create({
          data: this.buildAssignmentCreateData(eventId, plan),
        });
        const updatedOld = await prisma.opsCoordinatorAssignment
          .update({
            where: { id: assignmentId },
            data: {
              status: CoordinatorAssignmentStatus.Replaced,
              replacedAt: new Date(),
              replacedBy: actor.name,
              replacementReason: input.reason ?? '',
              replacedByAssignmentId: newAssignment.id,
            },
          })
          .catch(() => {
            throw new NotFoundException('Coordinator assignment not found');
          });
        return { newAssignment, oldAssignment: updatedOld };
      },
      sideEffects: async ({ newAssignment, oldAssignment: updatedOld }, transactionContext) => {
        if (!plan) return;
        await Promise.all([
          this.auditWriter.write({
            eventId,
            actor: actor.name,
            action: `Replaced ${updatedOld.coordinatorName} with ${plan.coordinator.name}`,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: updatedOld.id,
            affectedLabel: updatedOld.coordinatorName,
            metadata: { reason: input.reason ?? '', replacementAssignmentId: newAssignment.id },
          }, transactionContext),
          this.auditWriter.write({
            eventId,
            actor: actor.name,
            action: `Assigned ${plan.coordinator.name} as ${plan.role} (replacement)`,
            actionType: AuditActionType.Assign,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: newAssignment.id,
            affectedLabel: `${plan.coordinator.name} - ${plan.role}`,
            metadata: { replacedAssignmentId: updatedOld.id },
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
        outgoing: this.mapCoordinatorAssignment(updatedOld),
        incoming: this.mapCoordinatorAssignment(newAssignment),
      }),
    });
  }

  mapCoordinator(coordinator: OpsCoordinator) {
    return {
      id: coordinator.id,
      userId: coordinator.userId ?? null,
      name: coordinator.name,
      email: coordinator.email,
      photoUrl: coordinator.photoUrl ?? null,
      roleTags: coordinator.roleTags,
      skillsTags: coordinator.skillsTags,
      active: coordinator.active,
      createdAt: timestamp(coordinator.createdAt),
    };
  }

  mapCoordinatorAssignment(assignment: OpsCoordinatorAssignment) {
    return {
      id: assignment.id,
      eventId: assignment.eventId,
      coordinatorId: assignment.coordinatorId ?? null,
      coordinatorName: assignment.coordinatorName,
      role: assignment.role,
      status: assignment.status,
      attendanceStatus: (assignment as OpsCoordinatorAssignment & { attendanceStatus?: string }).attendanceStatus ?? 'pending',
      attendanceMarkedAt: (assignment as OpsCoordinatorAssignment & { attendanceMarkedAt?: Date | null }).attendanceMarkedAt
        ? timestamp((assignment as OpsCoordinatorAssignment & { attendanceMarkedAt: Date }).attendanceMarkedAt)
        : null,
      attendanceNotes: (assignment as OpsCoordinatorAssignment & { attendanceNotes?: string }).attendanceNotes ?? '',
      replacedByAssignmentId:
        (assignment as OpsCoordinatorAssignment & { replacedByAssignmentId?: string | null }).replacedByAssignmentId ?? null,
      replacementReason:
        (assignment as OpsCoordinatorAssignment & { replacementReason?: string }).replacementReason ?? '',
      replacedAt: (assignment as OpsCoordinatorAssignment & { replacedAt?: Date | null }).replacedAt
        ? timestamp((assignment as OpsCoordinatorAssignment & { replacedAt: Date }).replacedAt)
        : null,
      replacedBy: (assignment as OpsCoordinatorAssignment & { replacedBy?: string | null }).replacedBy ?? null,
      doubleBookingWarning: assignment.doubleBookingWarning,
      eventDate: assignment.eventDate ? isoDate(assignment.eventDate) : null,
      conflictEventId: assignment.conflictEventId ?? null,
      conflictEventName: assignment.conflictEventName ?? null,
      acknowledgedAt: assignment.acknowledgedAt ? timestamp(assignment.acknowledgedAt) : null,
      createdAt: timestamp(assignment.createdAt),
    };
  }

  private async resolveCoordinator(input: CreateCoordinatorAssignmentInput) {
    const coordinator = input.coordinatorId
      ? await this.prisma.opsCoordinator.findUnique({ where: { id: input.coordinatorId } })
      : await this.prisma.opsCoordinator.findFirst({
          where: { name: input.coordinatorName ?? '', active: true },
        });

    if (!coordinator) throw new NotFoundException('Coordinator not found');
    if (!coordinator.active) throw new BadRequestException('Coordinator is inactive');
    return coordinator as OpsCoordinator;
  }
  private sameText(left?: string | null, right?: string | null) {
    return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
