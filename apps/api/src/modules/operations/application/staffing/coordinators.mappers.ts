import type { OpsCoordinator, OpsCoordinatorAssignment } from '@prisma/client';
import { isoDate, timestamp } from './staffing.utils';

export function mapCoordinator(coordinator: OpsCoordinator) {
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

export function mapCoordinatorAssignment(assignment: OpsCoordinatorAssignment) {
  const withHistory = assignment as OpsCoordinatorAssignment & {
    acknowledgmentHistory?: Array<{
      id: string;
      assignmentId: string;
      state: string;
      reason: string;
      actor: string;
      createdAt: Date;
    }>;
  };
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
    acknowledgedBy: assignment.acknowledgedBy ?? null,
    acknowledgementReason: assignment.acknowledgementReason ?? '',
    withdrawalReason: assignment.withdrawalReason ?? '',
    withdrawnAt: assignment.withdrawnAt ? timestamp(assignment.withdrawnAt) : null,
    withdrawnBy: assignment.withdrawnBy ?? null,
    acknowledgementHistory: withHistory.acknowledgmentHistory?.map((entry) => ({
      id: entry.id,
      assignmentId: entry.assignmentId,
      state: entry.state,
      reason: entry.reason,
      actor: entry.actor,
      createdAt: timestamp(entry.createdAt),
    })) ?? [],
    createdAt: timestamp(assignment.createdAt),
  };
}
