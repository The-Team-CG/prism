import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment, OpsEvent, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { lockCoordinatorAssignmentDay } from '@prism/kernel/shared-kernel';
import type { ReplaceCoordinatorAssignmentInput, UpdateCoordinatorAttendanceInput } from '@prism/types';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  CoordinatorAssignmentStatus,
  CoordinatorAttendanceStatus,
  isOpsConstantValue,
  WorkflowCommandService,
} from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { COORDINATOR_RELIABILITY_WRITER, type CoordinatorReliabilityWriter } from '@prism/contexts/operations';
import { recordEventDayLog } from './event-day-log.writer';
import type { LiveOpsActor } from './live-ops.types';

export type { ReplaceCoordinatorAssignmentInput, UpdateCoordinatorAttendanceInput } from '@prism/types';

function requireReplacementFields(input: ReplaceCoordinatorAssignmentInput) {
  if (!input.replacementCoordinatorId?.trim()) throw new BadRequestException('Replacement coordinator is required');
  const role = input.role?.trim();
  if (!role) throw new BadRequestException('Replacement role is required');
  const reason = input.reason?.trim();
  if (!reason) throw new BadRequestException('Replacement reason is required');
  return { role, reason };
}

function requireReplacementCoordinator(coordinator: OpsCoordinator | null, role: string) {
  if (!coordinator || !coordinator.active) throw new NotFoundException('Replacement coordinator not found');
  if (Array.isArray(coordinator.roleTags) && coordinator.roleTags.length > 0 && !coordinator.roleTags.includes(role)) {
    throw new BadRequestException(`${coordinator.name} is not tagged for ${role}`);
  }
  return coordinator;
}

type CoordinatorAttendanceStatusValue = (typeof CoordinatorAttendanceStatus)[keyof typeof CoordinatorAttendanceStatus];
@Injectable()
export class CoordinatorLiveOpsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(COORDINATOR_RELIABILITY_WRITER) private readonly reliabilityWriter: CoordinatorReliabilityWriter,
  ) {}

  async replaceCoordinatorAssignment(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: LiveOpsActor,
  ) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    const notificationOutboxWriter = this.requireNotificationOutboxWriter();
    let event: Pick<OpsEvent, 'id' | 'eventName' | 'eventDate'> | null = null;
    let current: OpsCoordinatorAssignment | null = null;
    let coordinator: OpsCoordinator | null = null;
    let role = '';
    let reason = '';

    return this.workflowCommandService.execute<{
      replacedAssignment: OpsCoordinatorAssignment;
      replacementAssignment: OpsCoordinatorAssignment;
    }>({
      name: 'replace_coordinator_assignment',
      eventId,
      validateState: async () => {
        event = await prisma.opsEvent.findUnique({
          where: { id: eventId },
          select: { id: true, eventName: true, eventDate: true },
        });
        if (!event) throw new NotFoundException('Event not found');
        const fields = requireReplacementFields(input);
        role = fields.role;
        reason = fields.reason;

        current = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Coordinator assignment not found');

        coordinator = requireReplacementCoordinator(
          await prisma.opsCoordinator.findUnique({
            where: { id: input.replacementCoordinatorId.trim() },
          }),
          role,
        );
      },
      write: () => {
        if (!event || !current || !coordinator) throw new NotFoundException('Coordinator assignment not found');
        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const assignmentDate = current!.eventDate ?? event!.eventDate;
          if (assignmentDate) {
            await lockCoordinatorAssignmentDay(tx, coordinator!.id, assignmentDate);
            const availabilityModel = 'opsCoordinatorAvailability' in tx ? tx.opsCoordinatorAvailability : undefined;
            const unavailable = availabilityModel
              ? await availabilityModel.findFirst({
                  where: { coordinatorId: coordinator!.id, startsAt: { lte: assignmentDate }, endsAt: { gt: assignmentDate } },
                  orderBy: { startsAt: 'asc' },
                })
              : null;
            if (unavailable) {
              throw new BadRequestException(
                `${coordinator!.name} is unavailable for ${assignmentDate.toISOString().slice(0, 10)} (${unavailable.kind}).`,
              );
            }
            const conflict = await tx.opsCoordinatorAssignment.findFirst({
              where: {
                coordinatorId: coordinator!.id,
                eventDate: assignmentDate,
                eventId: { not: eventId },
                status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced] },
              },
              include: { event: { select: { eventName: true } } },
            });
            if (conflict) {
              throw new BadRequestException(
                `${coordinator!.name} is already assigned to ${conflict.event.eventName} on this date.`,
              );
            }
          }
          const replacementAssignment = await tx.opsCoordinatorAssignment.create({
            data: {
              id: `coord_asg_${randomUUID()}`,
              eventId,
              coordinatorId: coordinator!.id,
              coordinatorName: coordinator!.name,
              role,
              status: CoordinatorAssignmentStatus.PendingAcknowledgement,
              attendanceStatus: CoordinatorAttendanceStatus.Pending,
              eventDate: current!.eventDate ?? event!.eventDate ?? null,
            },
          });
          const replacedAssignment = await tx.opsCoordinatorAssignment.update({
            where: { id: assignmentId },
            data: {
              status: CoordinatorAssignmentStatus.Replaced,
              attendanceStatus: CoordinatorAttendanceStatus.Replaced,
              attendanceMarkedAt: new Date(),
              attendanceNotes: reason,
              replacedByAssignmentId: replacementAssignment.id,
              replacementReason: reason,
              replacedAt: new Date(),
              replacedBy: actor.name,
            },
          });
          return { replacedAssignment, replacementAssignment };
        });
      },
      sideEffects: async ({ replacedAssignment, replacementAssignment }) => {
        if (!event || !coordinator) return;
        await Promise.all([
          this.reliabilityWriter.record({
            eventId,
            coordinatorId: replacedAssignment.coordinatorId ?? null,
            assignmentId: replacedAssignment.id,
            note: `${replacedAssignment.coordinatorName} replaced for ${replacedAssignment.role}: ${reason}`,
            severity: 'warning',
          }),
          recordEventDayLog(this.prisma,
            eventId,
            'coordinator_replaced',
            actor,
            `Replaced ${replacedAssignment.coordinatorName} with ${replacementAssignment.coordinatorName}`,
            'coordinator_assignment',
            replacedAssignment.id,
            {
              replacementAssignmentId: replacementAssignment.id,
              replacementCoordinatorId: replacementAssignment.coordinatorId,
              role,
              reason,
            },
          ),
          writeAudit(auditWriter, eventId, actor.name, `Replaced coordinator: ${replacedAssignment.coordinatorName}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: replacedAssignment.id,
            affectedLabel: `${replacedAssignment.coordinatorName} - ${replacedAssignment.role}`,
            severity: 'warning',
            metadata: {
              replacementAssignmentId: replacementAssignment.id,
              replacementCoordinatorId: replacementAssignment.coordinatorId,
              replacementCoordinatorName: replacementAssignment.coordinatorName,
              role,
              reason,
            },
          }),
          writeNotification(notificationOutboxWriter,
            eventId,
            replacedAssignment.coordinatorName,
            `Coordinator replacement recorded for ${event.eventName}: ${reason}`,
            'viber',
          ),
          writeNotification(notificationOutboxWriter,
            eventId,
            coordinator.email ?? coordinator.name,
            `Coordinator replacement assignment issued: ${event.eventName} (${role})`,
          ),
        ]);
      },
    });
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actor: LiveOpsActor,
  ) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    let current: OpsCoordinatorAssignment | null = null;
    let status: CoordinatorAttendanceStatusValue = CoordinatorAttendanceStatus.Pending;

    return this.workflowCommandService.execute<OpsCoordinatorAssignment>({
      name: 'update_coordinator_attendance',
      eventId,
      validateState: async () => {
        const requestedStatus = input.status?.trim();
        if (!isOpsConstantValue(CoordinatorAttendanceStatus, requestedStatus)) {
          throw new BadRequestException('Unsupported coordinator attendance status');
        }
        status = requestedStatus;
        current = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Coordinator assignment not found');
      },
      write: () =>
        prisma.opsCoordinatorAssignment.update({
          where: { id: assignmentId },
          data: {
            attendanceStatus: status,
            attendanceMarkedAt: new Date(),
            attendanceNotes: input.notes?.trim() ?? '',
          },
        }),
      sideEffects: async (assignment) => {
        const reliabilityPromise =
          status === CoordinatorAttendanceStatus.Late ||
          status === CoordinatorAttendanceStatus.Absent ||
          status === CoordinatorAttendanceStatus.Replaced
            ? this.reliabilityWriter.record({
                eventId,
                coordinatorId: assignment.coordinatorId ?? null,
                assignmentId: assignment.id,
                note: `${assignment.coordinatorName} marked ${status}${input.notes ? `: ${input.notes.trim()}` : ''}`,
                severity: status === CoordinatorAttendanceStatus.Absent ? 'critical' : 'warning',
              })
            : Promise.resolve(null);

        await Promise.all([
          reliabilityPromise,
          recordEventDayLog(this.prisma,
            eventId,
            'coordinator_status_updated',
            actor,
            `Marked ${assignment.coordinatorName} ${status}`,
            'coordinator_assignment',
            assignment.id,
            { status, notes: input.notes ?? '', markedBy: actor.name },
          ),
          writeAudit(auditWriter, eventId, actor.name, `Updated coordinator attendance: ${assignment.coordinatorName}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'coordinator_assignment',
            affectedId: assignment.id,
            affectedLabel: `${assignment.coordinatorName} - ${assignment.role}`,
            metadata: { status, notes: input.notes ?? '', markedBy: actor.name },
          }),
        ]);
      },
    });
  }

  private requirePrisma() {
    if (!this.prisma) throw new Error('PrismaService is required for live operations writes');
    return this.prisma;
  }

  private requireAuditWriter() {
    if (!this.auditWriter) throw new Error('AuditWriter is required for live operations writes');
    return this.auditWriter;
  }

  private requireNotificationOutboxWriter() {
    if (!this.notificationOutboxWriter) throw new Error('NotificationOutboxWriter is required for live operations writes');
    return this.notificationOutboxWriter;
  }
}
