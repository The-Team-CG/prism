import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEventDayTask, OpsEventTaskReassignmentRequest, OpsUrgentIssue, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  EventDayTaskStatus,
  LiveOpsEscalationLevel,
  UrgentIssueSeverity,
  UrgentIssueStatus,
  isOpsConstantValue,
  WorkflowCommandService,
} from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import type {
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  DecideEventTaskReassignmentInput,
  EscalateLiveOpsInput,
  EscalateEventDayTaskInput,
  PrismEventTaskReassignmentRequest,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
} from '@prism/types';
import { resolveUrgentIssueStatusOnCreate } from '../domain/urgent-issue-status.policy';
import { EscalationPolicyViolation, resolveEscalationLevel } from '../domain/live-ops-escalation.policy';
import { computeSlaStatus } from '../domain/live-ops-sla.policy';
import { recordEventDayLog } from './event-day-log.writer';
import type { LiveOpsActor } from './live-ops.types';

export type {
  CreateEventDayTaskInput,
  CreateUrgentIssueInput,
  EscalateLiveOpsInput,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
  CreateEventTaskReassignmentInput,
  DecideEventTaskReassignmentInput,
} from '@prism/types';

type LiveOpsEscalationLevelValue = (typeof LiveOpsEscalationLevel)[keyof typeof LiveOpsEscalationLevel];

function assignIfPresent(data: Record<string, unknown>, present: unknown, fields: Record<string, unknown>) {
  if (present) Object.assign(data, fields);
}

function urgentIssueUpdateData(
  current: OpsUrgentIssue,
  input: UpdateUrgentIssueInput,
  status?: string,
): Prisma.OpsUrgentIssueUpdateInput {
  const data: Record<string, unknown> = {};
  assignIfPresent(data, status, { status });
  assignIfPresent(data, input.affectedArea !== undefined, { affectedArea: input.affectedArea?.trim() });
  assignIfPresent(data, input.ownerRole !== undefined, { ownerRole: input.ownerRole?.trim() });
  assignIfPresent(data, input.ownerName !== undefined, { ownerName: input.ownerName?.trim() });
  assignIfPresent(data, input.resolution !== undefined, { resolution: input.resolution?.trim() });
  if (input.slaDueAt !== undefined) {
    data.slaDueAt = input.slaDueAt ? new Date(input.slaDueAt) : null;
  }
  if (status === UrgentIssueStatus.Resolved && !current.resolvedAt) {
    data.resolvedAt = new Date();
  }
  return data as Prisma.OpsUrgentIssueUpdateInput;
}

@Injectable()
export class LiveOpsTaskIssueCommandService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly accountContacts: AccountContactReadModel,
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
          recordEventDayLog(this.prisma, eventId, 'task_created', actor, `Created event-day task: ${title}`, 'event_day_task', task.id, {
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
          recordEventDayLog(this.prisma, eventId, 'task_updated', actor, `Updated event-day task: ${task.title}`, 'event_day_task', task.id, {
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

  async requestTaskReassignment(
    eventId: string,
    taskId: string,
    input: CreateEventTaskReassignmentInput,
    actor: LiveOpsActor,
  ) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    const notificationOutboxWriter = this.requireNotificationOutboxWriter();
    let task: OpsEventDayTask | null = null;
    let toOwnerRole = '';
    let toOwnerName = '';
    let reason = '';

    return this.workflowCommandService.execute<OpsEventTaskReassignmentRequest, PrismEventTaskReassignmentRequest>({
      name: 'request_event_day_task_reassignment',
      eventId,
      validateState: async () => {
        task = await prisma.opsEventDayTask.findUnique({ where: { id: taskId } });
        if (task?.eventId !== eventId) task = null;
        if (!task) throw new NotFoundException('Event-day task not found');
        toOwnerRole = input.toOwnerRole.trim();
        toOwnerName = input.toOwnerName?.trim() ?? '';
        reason = input.reason.trim();
        if (!toOwnerRole) throw new BadRequestException('A reassignment role is required');
        if (!reason) throw new BadRequestException('A reassignment reason is required');
      },
      write: () => {
        if (!task) throw new NotFoundException('Event-day task not found');
        const now = new Date();
        return prisma.opsEventTaskReassignmentRequest.create({
          data: {
            id: `etr_${randomUUID()}`,
            eventId,
            taskId,
            requestedBy: actor.name,
            requestedByRole: actor.role,
            fromOwnerRole: task.assignedRole,
            fromOwnerName: task.ownerName,
            toOwnerRole,
            toOwnerName,
            reason,
            status: 'pending',
            requestedAt: now,
            autoApproveAt: new Date(now.getTime() + 2 * 60 * 1000),
          },
        });
      },
      sideEffects: async (request) => {
        const pmcmEmail = await this.resolveUserEmailByRole('pmcm-admin');
        await Promise.all([
          writeAudit(auditWriter, eventId, actor.name, `Requested task reassignment: ${task?.title ?? taskId}`, {
            actorRole: actor.role,
            actionType: AuditActionType.Create,
            category: AuditCategory.Events,
            affectedType: 'event_task_reassignment',
            affectedId: request.id,
            affectedLabel: task?.title ?? taskId,
            metadata: { taskId, toOwnerRole, toOwnerName, reason, autoApproveAt: request.autoApproveAt.toISOString() },
          }),
          ...(pmcmEmail ? [writeNotification(notificationOutboxWriter, eventId, pmcmEmail, `Task reassignment requested: ${task?.title ?? taskId}. Approval required.`, 'viber')] : [writeAudit(auditWriter, eventId, actor.name, 'Task reassignment notification not queued: no approved PMCM email address', { actorRole: actor.role, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event_task_reassignment', affectedId: request.id })]),
        ]);
      },
      project: (request) => this.mapTaskReassignment(request),
    });
  }

  async listTaskReassignmentRequests(eventId: string) {
    const requests = await this.requirePrisma().opsEventTaskReassignmentRequest.findMany({
      where: { eventId },
      orderBy: { requestedAt: 'desc' },
    });
    return requests.map((request) => this.mapTaskReassignment(request));
  }

  async decideTaskReassignment(
    eventId: string,
    requestId: string,
    input: DecideEventTaskReassignmentInput,
    actor: LiveOpsActor,
  ) {
    const prisma = this.requirePrisma();
    const auditWriter = this.requireAuditWriter();
    const notificationOutboxWriter = this.requireNotificationOutboxWriter();
    const now = new Date();
    const request = await prisma.opsEventTaskReassignmentRequest.findFirst({ where: { id: requestId, eventId } });
    if (!request) throw new NotFoundException('Task reassignment request not found');
    if (request.status !== 'pending') throw new BadRequestException('Task reassignment request is already decided');
    // autoApproveAt is metadata for a future system sweep. A submitted human
    // decision must never be rewritten based on elapsed time.
    const status = input.decision;
    const reason = input.reason?.trim() ?? '';
    if (status === 'rejected' && !reason) throw new BadRequestException('A rejection reason is required');

    const decided = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.opsEventTaskReassignmentRequest.updateMany({
        where: { id: requestId, eventId, status: 'pending' },
        data: { status, decidedAt: now, decidedBy: actor.name, decisionReason: reason || null },
      });
      if (claimed.count !== 1) throw new BadRequestException('Task reassignment request is already decided');
      const current = await tx.opsEventTaskReassignmentRequest.findUnique({ where: { id: requestId } });
      if (!current) throw new NotFoundException('Task reassignment request not found');
      if (status === 'approved') {
        await tx.opsEventDayTask.update({ where: { id: current.taskId }, data: { assignedRole: current.toOwnerRole, ownerName: current.toOwnerName } });
      }
      return current;
    });
    await Promise.all([
      writeAudit(auditWriter, eventId, actor.name, `${status === 'rejected' ? 'Rejected' : 'Approved'} task reassignment`, {
        actorRole: actor.role,
        actionType: status === 'rejected' ? AuditActionType.Decline : AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'event_task_reassignment',
        affectedId: decided.id,
        metadata: { taskId: decided.taskId, status, reason },
      }),
      ...(await this.resolveUserEmailByName(request.requestedBy) ? [writeNotification(notificationOutboxWriter, eventId, (await this.resolveUserEmailByName(request.requestedBy))!, `Task reassignment ${status.replace('_', ' ')} for ${request.taskId}`, 'viber')] : [writeAudit(auditWriter, eventId, actor.name, 'Task reassignment notification not queued: requester has no verified email address', { actorRole: actor.role, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event_task_reassignment', affectedId: decided.id })]),
    ]);
    return this.mapTaskReassignment(decided);
  }

  private async resolveUserEmailByRole(role: string) {
    const email = await this.accountContacts.findApprovedEmailByRole(role);
    const normalized = email?.trim().toLowerCase();
    return normalized?.includes('@') ? normalized : null;
  }

  private async resolveUserEmailByName(name: string) {
    const email = await this.accountContacts.findApprovedEmailByName(name);
    const normalized = email?.trim().toLowerCase();
    return normalized?.includes('@') ? normalized : null;
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
          recordEventDayLog(this.prisma, eventId, 'urgent_issue_created', actor, `Opened urgent issue: ${title}`, 'urgent_issue', issue.id, {
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
          data: urgentIssueUpdateData(current, input, status),
        });
      },
      sideEffects: async (issue) => {
        await Promise.all([
          recordEventDayLog(this.prisma, eventId, 'urgent_issue_updated', actor, `Updated urgent issue: ${issue.title}`, 'urgent_issue', issue.id, {
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

  async escalateEventDayTask(eventId: string, taskId: string, input: EscalateEventDayTaskInput, actor: LiveOpsActor) {
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
            slaStatus: computeSlaStatus(current),
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
          recordEventDayLog(this.prisma, eventId, 'task_escalated', actor, `Escalated event-day task: ${task.title}`, 'event_day_task', task.id, {
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
            slaStatus: computeSlaStatus(current),
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
          recordEventDayLog(this.prisma, eventId, 'urgent_issue_escalated', actor, `Escalated urgent issue: ${issue.title}`, 'urgent_issue', issue.id, {
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

  private mapTaskReassignment(request: {
    id: string;
    eventId: string;
    taskId: string;
    requestedBy: string;
    requestedByRole: string;
    fromOwnerRole: string;
    fromOwnerName: string;
    toOwnerRole: string;
    toOwnerName: string;
    reason: string;
    status: string;
    requestedAt: Date;
    autoApproveAt: Date;
    decidedAt: Date | null;
    decidedBy: string | null;
    decisionReason: string | null;
  }) {
    return {
      id: request.id,
      eventId: request.eventId,
      taskId: request.taskId,
      requestedBy: request.requestedBy,
      requestedByRole: request.requestedByRole,
      fromOwnerRole: request.fromOwnerRole,
      fromOwnerName: request.fromOwnerName,
      toOwnerRole: request.toOwnerRole,
      toOwnerName: request.toOwnerName,
      reason: request.reason,
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      autoApproveAt: request.autoApproveAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decidedBy: request.decidedBy ?? null,
      decisionReason: request.decisionReason ?? null,
    };
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
