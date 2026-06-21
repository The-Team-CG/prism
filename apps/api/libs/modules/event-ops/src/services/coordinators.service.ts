import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus } from '../ops.constants';
import { AuditService } from './audit.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { WorkflowCommandService } from './workflow-command.service';

export type CreateCoordinatorAssignmentInput = {
  coordinatorId?: string;
  coordinatorName?: string;
  role?: string;
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
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async listCoordinators() {
    const coordinators = await this.prisma.opsCoordinator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return coordinators.map((coordinator: OpsCoordinator) => this.mapCoordinator(coordinator));
  }

  async assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput) {
    let event: Awaited<ReturnType<CoordinatorsService['requireEvent']>> | null = null;
    let coordinator: OpsCoordinator | null = null;
    let role = '';
    let conflict: CoordinatorConflict | null = null;

    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<CoordinatorsService['mapCoordinatorAssignment']>
    >({
      name: 'assign_coordinator',
      eventId,
      validateState: async () => {
        event = await this.requireEvent(eventId);
        coordinator = await this.resolveCoordinator(input);
        role = input.role || coordinator.roleTags[0] || 'General Coordinator';

        if (!coordinator.roleTags.includes(role)) {
          throw new BadRequestException(`${coordinator.name} is not tagged for ${role}`);
        }

        conflict = await this.prisma.opsCoordinatorAssignment.findFirst({
          where: {
            coordinatorId: coordinator.id,
            eventDate: event.eventDate,
            eventId: { not: event.id },
            status: { not: CoordinatorAssignmentStatus.Cancelled },
          },
          include: { event: true },
          orderBy: { createdAt: 'desc' },
        }) as CoordinatorConflict | null;

        if (conflict && !input.overrideConflict) {
          throw new BadRequestException(
            `${coordinator.name} is already assigned to ${conflict.event.eventName} on this date.`,
          );
        }
      },
      write: () => {
        if (!event || !coordinator) throw new NotFoundException('Coordinator not found');
        return this.prisma.opsCoordinatorAssignment.create({
          data: {
            id: `coord_asg_${randomUUID()}`,
            eventId,
            coordinatorId: coordinator.id,
            coordinatorName: coordinator.name,
            role,
            status: CoordinatorAssignmentStatus.PendingAcknowledgement,
            doubleBookingWarning: Boolean(conflict),
            eventDate: event.eventDate,
            conflictEventId: conflict?.eventId ?? null,
            conflictEventName: conflict?.event.eventName ?? null,
          },
        });
      },
      sideEffects: async (assignment) => {
        if (!event || !coordinator) return;
        await Promise.all([
          this.auditService.audit(eventId, 'PMCM Admin', `Assigned ${coordinator.name} as ${role}`, {
            actionType: AuditActionType.Assign,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: assignment.id,
            affectedLabel: `${coordinator.name} - ${role}`,
            metadata: {
              coordinatorId: coordinator.id,
              conflictEventId: conflict?.eventId ?? null,
              conflictEventName: conflict?.event.eventName ?? null,
            },
          }),
          this.notificationOutboxService.queue(
            eventId,
            coordinator.email,
            `Coordinator assignment issued: ${event.eventName} (${role})`,
          ),
          this.notificationOutboxService.queue(eventId, assignment.coordinatorName, 'Coordinator assignment issued', 'viber'),
        ]);
      },
      project: (assignment) => this.mapCoordinatorAssignment(assignment),
    });
  }

  async acknowledgeCoordinator(eventId: string, assignmentId: string) {
    return this.workflowCommandService.execute<
      OpsCoordinatorAssignment,
      ReturnType<CoordinatorsService['mapCoordinatorAssignment']>
    >({
      name: 'acknowledge_coordinator_assignment',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
      },
      write: () =>
        this.prisma.opsCoordinatorAssignment
          .update({
            where: { id: assignmentId },
            data: { status: CoordinatorAssignmentStatus.Acknowledged, acknowledgedAt: new Date() },
          })
          .catch(() => {
            throw new NotFoundException('Coordinator assignment not found');
          }),
      sideEffects: async (assignment) => {
        await this.auditService.audit(eventId, assignment.coordinatorName, 'Acknowledged coordinator assignment', {
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'coordinator_assignment',
          affectedId: assignment.id,
          affectedLabel: assignment.coordinatorName,
        });
      },
      project: (assignment) => this.mapCoordinatorAssignment(assignment),
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

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
