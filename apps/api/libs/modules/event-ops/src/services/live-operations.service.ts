import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsEventDayTask, OpsUrgentIssue } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  EventDayTaskStatus,
  LiveOpsSlaStatus,
  UrgentIssueSeverity,
  UrgentIssueStatus,
} from '../ops.constants';
import { AuditService } from './audit.service';
import { WorkflowCommandService } from './workflow-command.service';

export type CreateEventDayTaskInput = {
  title: string;
  assignedRole?: string;
  ownerName?: string;
  priority?: string;
  notes?: string;
  dueAt?: string;
  slaDueAt?: string;
};

export type UpdateEventDayTaskInput = {
  status?: string;
  notes?: string;
  ownerName?: string;
  slaDueAt?: string;
};

export type CreateUrgentIssueInput = {
  title: string;
  description?: string;
  severity?: string;
  ownerRole?: string;
  ownerName?: string;
  openedBy?: string;
  slaDueAt?: string;
};

export type UpdateUrgentIssueInput = {
  status?: string;
  ownerRole?: string;
  ownerName?: string;
  resolution?: string;
  slaDueAt?: string;
};

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

const CLOSED_STATUSES = new Set(['done', 'resolved', 'cancelled', 'closed']);
const DUE_SOON_MS = 60 * 60 * 1000;

export class LiveOperationsService {
  constructor(
    private readonly prisma?: PrismaService,
    private readonly auditService?: AuditService,
    private readonly workflowCommandService = new WorkflowCommandService(),
  ) {}

  async createEventDayTask(eventId: string, input: CreateEventDayTaskInput, actor: LiveOpsActor) {
    const prisma = this.requirePrisma();
    const auditService = this.requireAuditService();
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
          auditService.audit(eventId, actor.name, `Created event-day task: ${title}`, {
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
    const auditService = this.requireAuditService();
    let current: OpsEventDayTask | null = null;
    let status: string | undefined;

    return this.workflowCommandService.execute<OpsEventDayTask>({
      name: 'update_event_day_task',
      eventId,
      validateState: async () => {
        current = (await prisma.opsEventDayTask.findMany({ where: { eventId } })).find((task) => task.id === taskId) ?? null;
        if (!current) throw new NotFoundException('Event-day task not found');
        status = input.status?.trim();
        if (status && !Object.values(EventDayTaskStatus).includes(status as any)) {
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
          auditService.audit(eventId, actor.name, `Updated event-day task: ${task.title}`, {
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
    const auditService = this.requireAuditService();
    let title = '';
    let severity = UrgentIssueSeverity.Medium;

    return this.workflowCommandService.execute<OpsUrgentIssue>({
      name: 'create_urgent_issue',
      eventId,
      validateState: () => {
        title = input.title?.trim();
        if (!title) throw new BadRequestException('Issue title is required');
        severity = (input.severity?.trim() || UrgentIssueSeverity.Medium) as typeof severity;
        if (!Object.values(UrgentIssueSeverity).includes(severity as any)) {
          throw new BadRequestException('Unsupported urgent issue severity');
        }
      },
      write: () =>
        prisma.opsUrgentIssue.create({
          data: {
            id: `urg_${randomUUID()}`,
            eventId,
            title,
            description: input.description?.trim() ?? '',
            severity,
            status: input.ownerRole || input.ownerName ? UrgentIssueStatus.Assigned : UrgentIssueStatus.Open,
            ownerRole: input.ownerRole?.trim() ?? '',
            ownerName: input.ownerName?.trim() ?? '',
            openedBy: input.openedBy?.trim() || actor.name,
            slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
          },
        }),
      sideEffects: async (issue) => {
        await Promise.all([
          this.recordEventDayLog(eventId, 'urgent_issue_created', actor, `Opened urgent issue: ${title}`, 'urgent_issue', issue.id, {
            severity: issue.severity,
            ownerRole: issue.ownerRole,
          }),
          auditService.audit(eventId, actor.name, `Opened urgent issue: ${title}`, {
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
    const auditService = this.requireAuditService();
    let current: OpsUrgentIssue | null = null;
    let status: string | undefined;

    return this.workflowCommandService.execute<OpsUrgentIssue>({
      name: 'update_urgent_issue',
      eventId,
      validateState: async () => {
        current = (await prisma.opsUrgentIssue.findMany({ where: { eventId } })).find((issue) => issue.id === issueId) ?? null;
        if (!current) throw new NotFoundException('Urgent issue not found');
        status = input.status?.trim();
        if (status && !Object.values(UrgentIssueStatus).includes(status as any)) {
          throw new BadRequestException('Unsupported urgent issue status');
        }
      },
      write: () => {
        if (!current) throw new NotFoundException('Urgent issue not found');
        return prisma.opsUrgentIssue.update({
          where: { id: issueId },
          data: {
            ...(status ? { status } : {}),
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
          auditService.audit(eventId, actor.name, `Updated urgent issue: ${issue.title}`, {
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

  private requireAuditService() {
    if (!this.auditService) throw new Error('AuditService is required for live operations writes');
    return this.auditService;
  }
}
