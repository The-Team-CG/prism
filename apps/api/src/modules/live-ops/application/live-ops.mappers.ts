import { CoordinatorAttendanceStatus, LiveOpsEscalationLevel } from '@prism/kernel/event-core';
import type { OpsCoordinatorAssignment, OpsEventDayLog, OpsEventDayTask, OpsUrgentIssue } from '@prisma/client';

type SlaRecord = {
  status?: string | null;
  slaStatus?: string | null;
  slaDueAt?: Date | null;
  dueAt?: Date | null;
  resolvedAt?: Date | null;
  completedAt?: Date | null;
};
type ComputeSlaStatus = (record: SlaRecord) => string;
type CoordinatorAssignmentMapper = (assignment: OpsCoordinatorAssignment) => Record<string, unknown>;

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapEventDayTask(task: OpsEventDayTask, computeSlaStatus: ComputeSlaStatus) {
  return {
    id: task.id,
    eventId: task.eventId,
    title: task.title,
    assignedRole: task.assignedRole,
    ownerName: task.ownerName,
    priority: task.priority,
    status: task.status,
    notes: task.notes,
    dueAt: task.dueAt ? timestamp(task.dueAt) : null,
    slaDueAt: task.slaDueAt ? timestamp(task.slaDueAt) : null,
    slaStatus: computeSlaStatus(task),
    escalationLevel: task.escalationLevel ?? LiveOpsEscalationLevel.None,
    escalatedAt: task.escalatedAt ? timestamp(task.escalatedAt) : null,
    escalatedBy: task.escalatedBy ?? null,
    escalationNotes: task.escalationNotes ?? '',
    completedAt: task.completedAt ? timestamp(task.completedAt) : null,
    createdAt: timestamp(task.createdAt),
    updatedAt: timestamp(task.updatedAt),
  };
}

export function mapUrgentIssue(issue: OpsUrgentIssue, computeSlaStatus: ComputeSlaStatus) {
  return {
    id: issue.id,
    eventId: issue.eventId,
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    status: issue.status,
    affectedArea: issue.affectedArea ?? '',
    ownerRole: issue.ownerRole,
    ownerName: issue.ownerName,
    resolution: issue.resolution,
    openedBy: issue.openedBy,
    slaDueAt: issue.slaDueAt ? timestamp(issue.slaDueAt) : null,
    slaStatus: computeSlaStatus(issue),
    escalationLevel: issue.escalationLevel ?? LiveOpsEscalationLevel.None,
    escalatedAt: issue.escalatedAt ? timestamp(issue.escalatedAt) : null,
    escalatedBy: issue.escalatedBy ?? null,
    escalationNotes: issue.escalationNotes ?? '',
    resolvedAt: issue.resolvedAt ? timestamp(issue.resolvedAt) : null,
    createdAt: timestamp(issue.createdAt),
    updatedAt: timestamp(issue.updatedAt),
  };
}

export function mapEventDayLog(log: OpsEventDayLog) {
  return {
    id: log.id,
    eventId: log.eventId,
    actionType: log.actionType,
    actor: log.actor,
    actorRole: log.actorRole,
    message: log.message,
    relatedType: log.relatedType ?? null,
    relatedId: log.relatedId ?? null,
    metadata: log.metadata ?? {},
    createdAt: timestamp(log.createdAt),
  };
}

export function mapCoordinatorAssignmentForEventDay(
  assignment: OpsCoordinatorAssignment,
  mapCoordinatorAssignment: CoordinatorAssignmentMapper,
) {
  return {
    ...mapCoordinatorAssignment(assignment),
    attendanceStatus: assignment.attendanceStatus ?? CoordinatorAttendanceStatus.Pending,
    attendanceMarkedAt: assignment.attendanceMarkedAt ? timestamp(assignment.attendanceMarkedAt) : null,
    attendanceNotes: assignment.attendanceNotes ?? '',
    replacedByAssignmentId: assignment.replacedByAssignmentId ?? null,
    replacementReason: assignment.replacementReason ?? '',
    replacedAt: assignment.replacedAt ? timestamp(assignment.replacedAt) : null,
    replacedBy: assignment.replacedBy ?? null,
  };
}
