import type {
  OpsCoordinatorAssignment,
  OpsEventDayLog,
  OpsEventDayTask,
  OpsUrgentIssue,
} from '@prisma/client';
import type {
  PrismCoordinatorAssignment,
  PrismEventDayLog,
  PrismEventDayStatusFeed,
  PrismEventDayStatusFeedItem,
  PrismEventDayTask,
  PrismLiveOps,
  PrismSupplierQuoteRequest,
  PrismUrgentIssue,
} from '@prism/types';
import { CoordinatorAttendanceStatus, LiveOpsEscalationLevel } from '@prism/modules/event-core';

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

function timestamp(value: Date) {
  return value.toISOString();
}

export function computeSlaStatus(record: SlaRecord, now = new Date()) {
  if (record.resolvedAt || record.completedAt || CLOSED_STATUSES.has(record.status ?? '')) {
    return 'resolved';
  }

  const dueAt = record.slaDueAt ?? record.dueAt ?? null;
  if (!dueAt) return record.slaStatus && record.slaStatus !== 'on_track' ? record.slaStatus : 'on_track';
  if (dueAt.getTime() < now.getTime()) return 'overdue';
  if (dueAt.getTime() - now.getTime() <= DUE_SOON_MS) return 'due_soon';
  return 'on_track';
}

export function mapEventDayTask(task: OpsEventDayTask): PrismEventDayTask {
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

export function mapUrgentIssue(issue: OpsUrgentIssue): PrismUrgentIssue {
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

export function mapEventDayLog(log: OpsEventDayLog): PrismEventDayLog {
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
  mappedAssignment: PrismCoordinatorAssignment,
): PrismCoordinatorAssignment {
  return {
    ...mappedAssignment,
    attendanceStatus: assignment.attendanceStatus ?? CoordinatorAttendanceStatus.Pending,
    attendanceMarkedAt: assignment.attendanceMarkedAt ? timestamp(assignment.attendanceMarkedAt) : null,
    attendanceNotes: assignment.attendanceNotes ?? '',
    replacedByAssignmentId: assignment.replacedByAssignmentId ?? null,
    replacementReason: assignment.replacementReason ?? '',
    replacedAt: assignment.replacedAt ? timestamp(assignment.replacedAt) : null,
    replacedBy: assignment.replacedBy ?? null,
  };
}

export function buildStatusFeed(input: {
  event: PrismLiveOps['event'];
  role?: string;
  tasks: PrismEventDayTask[];
  urgentIssues: PrismUrgentIssue[];
  supplierStatuses: Array<
    Pick<
      PrismSupplierQuoteRequest,
      'id' | 'supplierName' | 'category' | 'eventDayStatus' | 'eventDayVerificationStatus' | 'verificationStatus'
    >
  >;
  coordinatorAssignments: PrismLiveOps['coordinatorAssignments'];
  eventDayLogs: PrismEventDayLog[];
  guestAttendanceCount: number;
  guestCheckIns: PrismLiveOps['guestCheckIns'];
  includeGuestDetails: boolean;
}): PrismEventDayStatusFeed {
  const items: PrismEventDayStatusFeedItem[] = [
    ...input.tasks.map((task) => ({
      id: task.id,
      type: 'task' as const,
      title: task.title,
      status: task.status,
      role: task.assignedRole,
      slaStatus: task.slaStatus,
      escalationLevel: task.escalationLevel,
    })),
    ...input.urgentIssues.map((issue) => ({
      id: issue.id,
      type: 'urgent_issue' as const,
      title: issue.title,
      status: issue.status,
      role: issue.ownerRole,
      slaStatus: issue.slaStatus,
      escalationLevel: issue.escalationLevel,
    })),
    ...input.supplierStatuses.map((supplier) => ({
      id: supplier.id,
      type: 'supplier_status' as const,
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
