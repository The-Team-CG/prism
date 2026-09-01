import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsCoordinator, OpsCoordinatorAssignment, OpsEvent, OpsEventDayTask, OpsUrgentIssue, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import type {
  CreateEventDayTaskInput,
  CreateUrgentIssueInput,
  EscalateLiveOpsInput,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
} from '@prism/types';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  CoordinatorAssignmentStatus,
  CoordinatorAttendanceStatus,
  EventDayTaskStatus,
  LiveOpsEscalationLevel,
  LiveOpsSlaStatus,
  UrgentIssueSeverity,
  UrgentIssueStatus,
  isOpsConstantValue,
  WorkflowCommandService,
} from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { resolveUrgentIssueStatusOnCreate } from '../domain/urgent-issue-status.policy';
import { EscalationPolicyViolation, resolveEscalationLevel } from '../domain/live-ops-escalation.policy';

export type {
  CreateEventDayTaskInput,
  CreateUrgentIssueInput,
  EscalateLiveOpsInput,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
} from '@prism/types';

export type LiveOpsActor = {
  name: string;
  role: string;
  email?: string;
};

type SlaRecord = {
  status?: string | null;
  slaStatus?: string | null;
  slaDueAt?: Date | null;
  dueAt?: Date | null;
  resolvedAt?: Date | null;
  completedAt?: Date | null;
};

type LiveOpsEscalationLevelValue = (typeof LiveOpsEscalationLevel)[keyof typeof LiveOpsEscalationLevel];
type CoordinatorAttendanceStatusValue = (typeof CoordinatorAttendanceStatus)[keyof typeof CoordinatorAttendanceStatus];

const CLOSED_STATUSES = new Set(['done', 'resolved', 'cancelled', 'closed']);
const DUE_SOON_MS = 60 * 60 * 1000;

@Injectable()
export class LiveOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async createEventDayTask(eventId: string, input: CreateEventDayTaskInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    let title = '';

    return this.workflowCommandService.execute<OpsEventDayTask>({
      name: 'create_event_day_task',
      eventId,
      validateState: () => {
        title = input.title?.trim();
        if (!title) throw new BadRequestException('Task title is required');
      },
      write: () =>
        prisma.opsEventDayTask.create({
          data: {
            id: `edt_${randomUUID()}`,
            eventId,
            title,
            assignedRole: input.assignedRole?.trim() || 'General Coordinator',
            ownerName: input.ownerName?.trim() ?? '',
            priority: input.priority?.trim() || 'normal',
            status: EventDayTaskStatus.Open,
            notes: input.notes?.trim() ?? '',
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : input.dueAt ? new Date(input.dueAt) : null,
          },
        }),
      sideEffects: async (task) => {
        await Promise.all([
          this.recordEventDayLog(eventId, 'task_created', actor, `Created event-day task: ${title}`, 'event_day_task', task.id, {
            assignedRole: task.assignedRole,
            priority: task.priority,
          }),
          writeAudit(auditWriter, eventId, actor.name, `Created event-day task: ${title}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Create,
            category: AuditCategory.Events,
            affectedType: 'event_day_task',
            affectedId: task.id,
            affectedLabel: title,
          }),
        ]);
      },
    });
  }

  async updateEventDayTask(eventId: string, taskId: string, input: UpdateEventDayTaskInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    let current: OpsEventDayTask | null = null;
    let status: string | undefined;

    return this.workflowCommandService.execute<OpsEventDayTask>({
      name: 'update_event_day_task',
      eventId,
      validateState: async () => {
        current = await prisma.opsEventDayTask.findUnique({ where: { id: taskId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Event-day task not found');
        status = input.status?.trim();
        if (status && !isOpsConstantValue(EventDayTaskStatus, status)) {
          throw new BadRequestException('Unsupported event-day task status');
        }
      },
      write: () => {
        if (!current) throw new NotFoundException('Event-day task not found');
        return prisma.opsEventDayTask.update({
          where: { id: taskId },
          data: {
            ...(status ? { status } : {}),
            ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
            ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
            ...(input.slaDueAt !== undefined ? { slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null } : {}),
            ...(status === EventDayTaskStatus.Done && !current.completedAt ? { completedAt: new Date() } : {}),
          },
        });
      },
      sideEffects: async (task) => {
        await Promise.all([
          this.recordEventDayLog(eventId, 'task_updated', actor, `Updated event-day task: ${task.title}`, 'event_day_task', task.id, {
            status: task.status,
          }),
          writeAudit(auditWriter, eventId, actor.name, `Updated event-day task: ${task.title}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'event_day_task',
            affectedId: task.id,
            affectedLabel: task.title,
            metadata: { status: task.status },
          }),
        ]);
      },
    });
  }

  async createUrgentIssue(eventId: string, input: CreateUrgentIssueInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    let title = '';
    let severity: UrgentIssueSeverity = UrgentIssueSeverity.Medium;

    return this.workflowCommandService.execute<OpsUrgentIssue>({
      name: 'create_urgent_issue',
      eventId,
      validateState: () => {
        title = input.title?.trim();
        if (!title) throw new BadRequestException('Issue title is required');
        const requestedSeverity = input.severity?.trim() || UrgentIssueSeverity.Medium;
        if (!isOpsConstantValue(UrgentIssueSeverity, requestedSeverity)) {
          throw new BadRequestException('Unsupported urgent issue severity');
        }
        severity = requestedSeverity;
      },
      write: () =>
        prisma.opsUrgentIssue.create({
          data: {
            id: `urg_${randomUUID()}`,
            eventId,
            title,
            description: input.description?.trim() ?? '',
            severity,
            status: resolveUrgentIssueStatusOnCreate(input),
            affectedArea: input.affectedArea?.trim() ?? '',
            ownerRole: input.ownerRole?.trim() ?? '',
            ownerName: input.ownerName?.trim() ?? '',
            openedBy: actor.name,
            slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
          },
        }),
      sideEffects: async (issue) => {
        await Promise.all([
          this.recordEventDayLog(eventId, 'urgent_issue_created', actor, `Opened urgent issue: ${title}`, 'urgent_issue', issue.id, {
            severity: issue.severity,
            ownerRole: issue.ownerRole,
          }),
          writeAudit(auditWriter, eventId, actor.name, `Opened urgent issue: ${title}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Create,
            category: AuditCategory.Events,
            affectedType: 'urgent_issue',
            affectedId: issue.id,
            affectedLabel: title,
            severity: issue.severity === UrgentIssueSeverity.Critical ? 'critical' : 'warning',
          }),
        ]);
      },
    });
  }

  async updateUrgentIssue(eventId: string, issueId: string, input: UpdateUrgentIssueInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    let current: OpsUrgentIssue | null = null;
    let status: string | undefined;

    return this.workflowCommandService.execute<OpsUrgentIssue>({
      name: 'update_urgent_issue',
      eventId,
      validateState: async () => {
        current = await prisma.opsUrgentIssue.findUnique({ where: { id: issueId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Urgent issue not found');
        status = input.status?.trim();
        if (status && !isOpsConstantValue(UrgentIssueStatus, status)) {
          throw new BadRequestException('Unsupported urgent issue status');
        }
      },
      write: () => {
        if (!current) throw new NotFoundException('Urgent issue not found');
        return prisma.opsUrgentIssue.update({
          where: { id: issueId },
          data: {
            ...(status ? { status } : {}),
            ...(input.affectedArea !== undefined ? { affectedArea: input.affectedArea.trim() } : {}),
            ...(input.ownerRole !== undefined ? { ownerRole: input.ownerRole.trim() } : {}),
            ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
            ...(input.resolution !== undefined ? { resolution: input.resolution.trim() } : {}),
            ...(input.slaDueAt !== undefined ? { slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null } : {}),
            ...(status === UrgentIssueStatus.Resolved && !current.resolvedAt ? { resolvedAt: new Date() } : {}),
          },
        });
      },
      sideEffects: async (issue) => {
        await Promise.all([
          this.recordEventDayLog(eventId, 'urgent_issue_updated', actor, `Updated urgent issue: ${issue.title}`, 'urgent_issue', issue.id, {
            status: issue.status,
            resolution: issue.resolution,
          }),
          writeAudit(auditWriter, eventId, actor.name, `Updated urgent issue: ${issue.title}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'urgent_issue',
            affectedId: issue.id,
            affectedLabel: issue.title,
            metadata: { status: issue.status, resolution: issue.resolution },
          }),
        ]);
      },
    });
  }

  async escalateEventDayTask(eventId: string, taskId: string, input: EscalateLiveOpsInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    const notificationOutboxWriter = this.requireNotificationOutboxWriter();
    let current: OpsEventDayTask | null = null;
    let escalationLevel: LiveOpsEscalationLevelValue = LiveOpsEscalationLevel.RoleLead;
    let notes = '';

    return this.workflowCommandService.execute<OpsEventDayTask>({
      name: 'escalate_event_day_task',
      eventId,
      validateState: async () => {
        try {
          escalationLevel = resolveEscalationLevel(input.escalationLevel);
        } catch (error) {
          if (error instanceof EscalationPolicyViolation) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }
        notes = input.notes?.trim() ?? '';
        if (!notes) throw new BadRequestException('Escalation notes are required');
        current = await prisma.opsEventDayTask.findUnique({ where: { id: taskId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Event-day task not found');
      },
      write: () => {
        if (!current) throw new NotFoundException('Event-day task not found');
        return prisma.opsEventDayTask.update({
          where: { id: taskId },
          data: {
            ...(input.ownerRole !== undefined ? { assignedRole: input.ownerRole.trim() } : {}),
            ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
            slaStatus: this.computeSlaStatus(current),
            escalationLevel,
            escalatedAt: new Date(),
            escalatedBy: actor.name,
            escalationNotes: notes,
          },
        });
      },
      sideEffects: async (task) => {
        const recipient = input.ownerName?.trim() || task.ownerName || task.assignedRole || 'PMCM Live Ops';
        await Promise.all([
          this.recordEventDayLog(eventId, 'task_escalated', actor, `Escalated event-day task: ${task.title}`, 'event_day_task', task.id, {
            escalationLevel,
            notes,
            ownerRole: input.ownerRole ?? task.assignedRole,
            ownerName: input.ownerName ?? task.ownerName,
          }),
          writeAudit(auditWriter, eventId, actor.name, `Escalated event-day task: ${task.title}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'event_day_task',
            affectedId: task.id,
            affectedLabel: task.title,
            severity: escalationLevel === LiveOpsEscalationLevel.Critical ? 'critical' : 'warning',
            metadata: { escalationLevel, notes, ownerRole: input.ownerRole ?? task.assignedRole, ownerName: input.ownerName ?? task.ownerName },
          }),
          writeNotification(notificationOutboxWriter, eventId, recipient, `Event-day task escalated: ${task.title}`, 'viber'),
        ]);
      },
    });
  }

  async escalateUrgentIssue(eventId: string, issueId: string, input: EscalateLiveOpsInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    const notificationOutboxWriter = this.requireNotificationOutboxWriter();
    let current: OpsUrgentIssue | null = null;
    let escalationLevel: LiveOpsEscalationLevelValue = LiveOpsEscalationLevel.RoleLead;
    let notes = '';

    return this.workflowCommandService.execute<OpsUrgentIssue>({
      name: 'escalate_urgent_issue',
      eventId,
      validateState: async () => {
        try {
          escalationLevel = resolveEscalationLevel(input.escalationLevel);
        } catch (error) {
          if (error instanceof EscalationPolicyViolation) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }
        notes = input.notes?.trim() ?? '';
        if (!notes) throw new BadRequestException('Escalation notes are required');
        current = await prisma.opsUrgentIssue.findUnique({ where: { id: issueId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Urgent issue not found');
      },
      write: () => {
        if (!current) throw new NotFoundException('Urgent issue not found');
        return prisma.opsUrgentIssue.update({
          where: { id: issueId },
          data: {
            ...(input.ownerRole !== undefined ? { ownerRole: input.ownerRole.trim() } : {}),
            ...(input.ownerName !== undefined ? { ownerName: input.ownerName.trim() } : {}),
            ...(input.ownerRole || input.ownerName ? { status: UrgentIssueStatus.Assigned } : {}),
            slaStatus: this.computeSlaStatus(current),
            escalationLevel,
            escalatedAt: new Date(),
            escalatedBy: actor.name,
            escalationNotes: notes,
          },
        });
      },
      sideEffects: async (issue) => {
        const recipient = input.ownerName?.trim() || issue.ownerName || issue.ownerRole || 'PMCM Live Ops';
        await Promise.all([
          this.recordEventDayLog(eventId, 'urgent_issue_escalated', actor, `Escalated urgent issue: ${issue.title}`, 'urgent_issue', issue.id, {
            escalationLevel,
            notes,
            ownerRole: input.ownerRole ?? issue.ownerRole,
            ownerName: input.ownerName ?? issue.ownerName,
          }),
          writeAudit(auditWriter, eventId, actor.name, `Escalated urgent issue: ${issue.title}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Events,
            affectedType: 'urgent_issue',
            affectedId: issue.id,
            affectedLabel: issue.title,
            severity: escalationLevel === LiveOpsEscalationLevel.Critical ? 'critical' : 'warning',
            metadata: { escalationLevel, notes, ownerRole: input.ownerRole ?? issue.ownerRole, ownerName: input.ownerName ?? issue.ownerName },
          }),
          writeNotification(notificationOutboxWriter, eventId, recipient, `Urgent issue escalated: ${issue.title}`, 'viber'),
        ]);
      },
    });
  }

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
        if (!input.replacementCoordinatorId?.trim()) throw new BadRequestException('Replacement coordinator is required');
        role = input.role?.trim();
        if (!role) throw new BadRequestException('Replacement role is required');
        reason = input.reason?.trim();
        if (!reason) throw new BadRequestException('Replacement reason is required');

        current = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
        if (current?.eventId !== eventId) current = null;
        if (!current) throw new NotFoundException('Coordinator assignment not found');

        coordinator = await prisma.opsCoordinator.findUnique({
          where: { id: input.replacementCoordinatorId.trim() },
        });
        if (!coordinator || !coordinator.active) throw new NotFoundException('Replacement coordinator not found');
        if (Array.isArray(coordinator.roleTags) && coordinator.roleTags.length > 0 && !coordinator.roleTags.includes(role)) {
          throw new BadRequestException(`${coordinator.name} is not tagged for ${role}`);
        }
      },
      write: () => {
        if (!event || !current || !coordinator) throw new NotFoundException('Coordinator assignment not found');
        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
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
          prisma.opsCoordinatorReliabilityNote.create({
            data: {
              id: `crn_${randomUUID()}`,
              eventId,
              coordinatorId: replacedAssignment.coordinatorId ?? null,
              assignmentId: replacedAssignment.id,
              note: `${replacedAssignment.coordinatorName} replaced for ${replacedAssignment.role}: ${reason}`,
              severity: 'warning',
            },
          }),
          this.recordEventDayLog(
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
            ? prisma.opsCoordinatorReliabilityNote.create({
                data: {
                  id: `crn_${randomUUID()}`,
                  eventId,
                  coordinatorId: assignment.coordinatorId ?? null,
                  assignmentId: assignment.id,
                  note: `${assignment.coordinatorName} marked ${status}${input.notes ? `: ${input.notes.trim()}` : ''}`,
                  severity: status === CoordinatorAttendanceStatus.Absent ? 'critical' : 'warning',
                },
              })
            : Promise.resolve(null);

        await Promise.all([
          reliabilityPromise,
          this.recordEventDayLog(
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

  computeSlaStatus(record: SlaRecord, now = new Date()) {
    if (record.resolvedAt || record.completedAt || CLOSED_STATUSES.has(record.status ?? '')) {
      return LiveOpsSlaStatus.Resolved;
    }

    const dueAt = record.slaDueAt ?? record.dueAt ?? null;
    if (!dueAt) return record.slaStatus && record.slaStatus !== 'on_track' ? record.slaStatus : LiveOpsSlaStatus.OnTrack;
    if (dueAt.getTime() < now.getTime()) return LiveOpsSlaStatus.Overdue;
    if (dueAt.getTime() - now.getTime() <= DUE_SOON_MS) return LiveOpsSlaStatus.DueSoon;
    return LiveOpsSlaStatus.OnTrack;
  }

  buildStatusFeed(input: {
    event: unknown;
    role?: string;
    tasks: Array<any>;
    urgentIssues: Array<any>;
    supplierStatuses: Array<any>;
    coordinatorAssignments: Array<any>;
    eventDayLogs: Array<any>;
    guestAttendanceCount: number;
    guestCheckIns: Array<any>;
    includeGuestDetails: boolean;
  }) {
    const items = [
      ...input.tasks.map((task) => ({
        id: task.id,
        type: 'task',
        title: task.title,
        status: task.status,
        role: task.assignedRole,
        slaStatus: task.slaStatus,
        escalationLevel: task.escalationLevel,
      })),
      ...input.urgentIssues.map((issue) => ({
        id: issue.id,
        type: 'urgent_issue',
        title: issue.title,
        status: issue.status,
        role: issue.ownerRole,
        slaStatus: issue.slaStatus,
        escalationLevel: issue.escalationLevel,
      })),
      ...input.supplierStatuses.map((supplier) => ({
        id: supplier.id,
        type: 'supplier_status',
        title: supplier.supplierName,
        status: supplier.eventDayStatus ?? 'not_started',
        role: supplier.category,
        verificationStatus: supplier.eventDayVerificationStatus ?? supplier.verificationStatus ?? 'self_reported',
      })),
    ];

    return {
      event: input.event,
      role: input.role,
      items,
      coordinatorAssignments: input.coordinatorAssignments,
      eventDayLogs: input.eventDayLogs,
      guestAttendanceCount: input.guestAttendanceCount,
      guestCheckIns: input.includeGuestDetails ? input.guestCheckIns : [],
    };
  }

  async recordEventDayLog(
    eventId: string,
    actionType: string,
    actor: LiveOpsActor,
    message: string,
    relatedType?: string,
    relatedId?: string,
    metadata: Record<string, unknown> = {},
  ) {
    const prisma = this.requirePrisma();
    return prisma.opsEventDayLog.create({
      data: {
        id: `edl_${randomUUID()}`,
        eventId,
        actionType,
        actor: actor.name,
        actorRole: actor.role,
        message,
        relatedType: relatedType ?? null,
        relatedId: relatedId ?? null,
        metadata: toPrismaJson(metadata),
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
