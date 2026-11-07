import type { OpsCoordinatorAssignment } from '@prisma/client';
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
import { CoordinatorAttendanceStatus } from '@prism/kernel/event-core';

function timestamp(value: Date) {
  return value.toISOString();
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
