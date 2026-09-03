export function sameCoordinatorName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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

export function shouldPreserveRoleViewOnAcknowledgeFailure() {
  return true;
}
