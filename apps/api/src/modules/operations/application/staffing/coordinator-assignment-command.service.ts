import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment, OpsEvent, Prisma } from '@prisma/client';
import {
  COORDINATOR_ROLES,
  canonicalCoordinatorRole,
  coordinatorRoleSchema,
} from '@prism/types';
import type {
  CreateCoordinatorAssignmentInput,
  CoordinatorAssignmentAcknowledgementInput,
  ReplaceCoordinatorAssignmentInput,
  WithdrawCoordinatorAssignmentInput,
} from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { lockCoordinatorAssignmentDay, type PrismCommandContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, OpsUserRole, WorkflowCommandService, WORKFLOW_COMMAND_LOG } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import type { StaffingCommands } from '../../contracts/staffing-commands.port';
import { mapCoordinatorAssignment } from './coordinators.mappers';
import { resolveCoordinatorForActor } from './coordinator-actor-lookup';
import { isoDate } from './staffing.utils';

type CoordinatorConflict = OpsCoordinatorAssignment & {
  event: {
    eventName: string;
  };
};

type CoordinatorAssignmentPlan = {
  event: OpsEvent;
  coordinator: OpsCoordinator;
  role: string;
  conflict: CoordinatorConflict | null;
};

@Injectable()
export class CoordinatorAssignmentCommandService implements StaffingCommands {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(WORKFLOW_COMMAND_LOG) private readonly workflowCommandService: WorkflowCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  private async resolveAssignmentPlan(
    eventId: string,
    input: CreateCoordinatorAssignmentInput,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<CoordinatorAssignmentPlan> {
    const event = await this.requireEvent(eventId, prisma);
    const coordinator = await this.resolveCoordinator(input, prisma);
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

    const conflict = (await prisma.opsCoordinatorAssignment.findFirst({
      where: {
        coordinatorId: coordinator.id,
        eventDate: event.eventDate,
        eventId: { not: event.id },
        status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] },
      },
      include: { event: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })) as CoordinatorConflict | null;

    if (conflict && !input.overrideConflict) {
      const sameRoleSuggestions = await this.listAvailableSameRole(event, role, coordinator.id, prisma);
      throw new BadRequestException({
        code: 'COORDINATOR_DOUBLE_BOOKING',
        message: `${coordinator.name} is already assigned to ${conflict.event.eventName} on this date.`,
        conflictEventId: conflict.eventId,
        conflictEventName: conflict.event.eventName,
        sameRoleSuggestions,
      });
    }

    return { event, coordinator, role, conflict };
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
      conflictEventName: plan.conflict?.event.eventName ?? null,
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
        await this.lockCoordinatorDate(transactionContext.prisma, input, eventId);
        plan = await this.resolveAssignmentPlan(eventId, input, transactionContext.prisma);
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
      ReturnType<typeof mapCoordinatorAssignment>
    >({
      name: 'acknowledge_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        await this.requireOwnedAssignment(eventId, assignmentId, actor);
      },
      validateStateInTransaction: async ({ prisma }) => {
        await this.requireOwnedAssignment(eventId, assignmentId, actor, prisma);
      },
      write: (transactionContext) => {
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsCoordinatorAssignment
          .update({
            where: { id: assignmentId },
            data: {
              status: input.decision === 'acknowledged' ? CoordinatorAssignmentStatus.Acknowledged : CoordinatorAssignmentStatus.Declined,
              acknowledgedAt: new Date(),
              acknowledgedBy: actor.id ?? actor.name,
              acknowledgementReason: input.reason ?? '',
            },
          })
          .catch(() => {
            throw new NotFoundException('Coordinator assignment not found');
          });
      },
      sideEffects: async (assignment, transactionContext) => {
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
              actor: actor.id ?? actor.name,
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
          metadata: { reason: input.reason ?? '' },
          }, transactionContext),
        ]);
      },
      project: (assignment) => mapCoordinatorAssignment(assignment),
    });
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
        await this.requireEvent(eventId);
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
      project: (assignment) => mapCoordinatorAssignment(assignment),
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
    let plan: Awaited<ReturnType<CoordinatorAssignmentCommandService['resolveAssignmentPlan']>> | null = null;
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
        outgoing: ReturnType<typeof mapCoordinatorAssignment>;
        incoming: ReturnType<typeof mapCoordinatorAssignment>;
      }
    >({
      name: 'replace_coordinator_assignment',
      eventId,
      context: commandContext,
      sideEffectMode: 'same_tx',
      validateState: async () => {
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
        oldAssignment = await transactionContext.prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId, eventId } });
        if (!oldAssignment) throw new NotFoundException('Coordinator assignment not found');
        if (oldAssignment.status === CoordinatorAssignmentStatus.Replaced ||
          (oldAssignment.status === CoordinatorAssignmentStatus.Cancelled && !oldAssignment.withdrawalReason)) {
          throw new BadRequestException('Coordinator assignment is already withdrawn or replaced');
        }
        await this.lockCoordinatorDate(transactionContext.prisma, {
          coordinatorId: input.replacementCoordinatorId,
          coordinatorName: input.replacementCoordinatorName,
        }, eventId);
        plan = await this.resolveAssignmentPlan(eventId, {
          coordinatorId: input.replacementCoordinatorId,
          coordinatorName: input.replacementCoordinatorName,
          role: input.replacementRole ?? input.role,
          overrideConflict: input.overrideConflict,
        }, transactionContext.prisma);
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
        outgoing: mapCoordinatorAssignment(updatedOld),
        incoming: mapCoordinatorAssignment(newAssignment),
      }),
    });
  }

  private async listAvailableSameRole(event: OpsEvent, role: string, excludeCoordinatorId: string, prisma: Prisma.TransactionClient | PrismaService = this.prisma) {
    const coordinators = await prisma.opsCoordinator.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const busy = await prisma.opsCoordinatorAssignment.findMany({
      where: {
        eventDate: event.eventDate,
        status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] },
      },
    });
    const busyIds = new Set(
      busy.map((row) => row.coordinatorId).filter((id): id is string => Boolean(id)),
    );
    const eventDateEnd = new Date(event.eventDate.getTime() + 24 * 60 * 60 * 1000);
    const availabilityModel = 'opsCoordinatorAvailability' in prisma ? prisma.opsCoordinatorAvailability : undefined;
    const unavailable = availabilityModel
      ? await availabilityModel.findMany({
          where: { startsAt: { lt: eventDateEnd }, endsAt: { gt: event.eventDate } },
          select: { coordinatorId: true },
        })
      : [];
    const unavailableIds = new Set(unavailable.map((item) => item.coordinatorId));
    return coordinators
      .filter(
        (item) => item.id !== excludeCoordinatorId && item.roleTags.includes(role) && !busyIds.has(item.id) && !unavailableIds.has(item.id),
      )
      .slice(0, 5)
      .map((item) => ({ id: item.id, name: item.name, role }));
  }

  private async resolveCoordinator(input: CreateCoordinatorAssignmentInput, prisma: Prisma.TransactionClient | PrismaService = this.prisma) {
    const coordinator = input.coordinatorId
      ? await prisma.opsCoordinator.findUnique({ where: { id: input.coordinatorId } })
      : await prisma.opsCoordinator.findFirst({
          where: { name: input.coordinatorName ?? '', active: true },
        });

    if (!coordinator) throw new NotFoundException('Coordinator not found');
    if (!coordinator.active) throw new BadRequestException('Coordinator is inactive');
    return coordinator as OpsCoordinator;
  }
  private async requireEvent(eventId: string, prisma: Prisma.TransactionClient | PrismaService = this.prisma) {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId } });
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
  ) {
    const coordinatorId = input.coordinatorId ?? input.replacementCoordinatorId;
    const coordinatorName = input.coordinatorName ?? input.replacementCoordinatorName;
    const coordinator = coordinatorId
      ? await prisma.opsCoordinator.findUnique({ where: { id: coordinatorId }, select: { id: true } })
      : coordinatorName
        ? await prisma.opsCoordinator.findFirst({ where: { name: coordinatorName }, select: { id: true } })
        : null;
    if (!coordinator) return;
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventDate: true } });
    if (!event?.eventDate) return;
    await lockCoordinatorAssignmentDay(prisma, coordinator.id, event.eventDate);
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
  ) {
    const assignment = await prisma.opsCoordinatorAssignment.findFirst({ where: { id: assignmentId } });
    if (!assignment || assignment.eventId !== eventId) {
      throw new NotFoundException('Coordinator assignment not found');
    }

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
  }
}
