export function sameCoordinatorName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Ack refresh failures must not wipe the role-safe desk (PA-294). */
export function shouldPreserveRoleViewOnAcknowledgeFailure() {
  return true;
}

export function isRegistrationCoordinatorRole(role?: string | null): boolean {
  if (!role) return false;
  return /registration/i.test(role);
}

export function pickActiveAssignment<T extends { attendanceStatus?: string; status?: string }>(
  assignments: T[],
): T | undefined {
  return (
    assignments.find(
      (item) => item.attendanceStatus !== "replaced" && item.status !== "replaced",
    ) ?? assignments[0]
  );
}

export function suggestAvailableSameRoleCoordinators(input: {
  coordinators: Array<{ id: string; name: string; active?: boolean; roleTags?: string[] }>;
  assignments: Array<{
    coordinatorId?: string | null;
    eventId: string;
    eventDate?: string | null;
    status?: string;
  }>;
  eventId: string;
  eventDate: string;
  role: string;
  excludeCoordinatorId: string;
}): Array<{ id: string; name: string }> {
  const busyIds = new Set(
    input.assignments
      .filter((assignment) => assignment.eventId !== input.eventId && assignment.eventDate === input.eventDate)
      .filter((assignment) => assignment.status !== "cancelled" && assignment.status !== "replaced")
      .map((assignment) => assignment.coordinatorId)
      .filter((id): id is string => Boolean(id)),
  );
  return input.coordinators
    .filter((coordinator) => coordinator.active !== false)
    .filter((coordinator) => coordinator.id !== input.excludeCoordinatorId)
    .filter((coordinator) => (coordinator.roleTags ?? []).includes(input.role))
    .filter((coordinator) => !busyIds.has(coordinator.id))
    .map((coordinator) => ({ id: coordinator.id, name: coordinator.name }));
}
