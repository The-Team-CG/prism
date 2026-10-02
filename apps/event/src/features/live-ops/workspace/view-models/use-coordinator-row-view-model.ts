import { useMemo, useState } from "react";
import { COORDINATOR_ROLES, canonicalCoordinatorRole } from "@prism/types";

import type {
  CoordinatorRole,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  ReplaceCoordinatorAssignmentInput,
} from "@prism/types";

type CoordinatorRowViewModelProps = {
  assignment: PrismCoordinatorAssignment;
  coordinators: PrismCoordinator[];
  busy: boolean;
  onReplace: (input: ReplaceCoordinatorAssignmentInput) => Promise<void>;
};

export function useCoordinatorRowViewModel({
  assignment,
  coordinators,
  busy,
  onReplace,
}: CoordinatorRowViewModelProps) {
  const [replacementCoordinatorId, setReplacementCoordinatorId] = useState("");
  const [replacementRole, setReplacementRoleState] = useState<CoordinatorRole | "">(
    canonicalCoordinatorRole(assignment.role) ?? "",
  );
  const [replacementReason, setReplacementReason] = useState("");

  const attendanceStatus = assignment.attendanceStatus ?? "pending";
  const eligibleCoordinators = useMemo(
    () => coordinators.filter((coordinator) => coordinator.id !== assignment.coordinatorId && coordinator.active),
    [assignment.coordinatorId, coordinators],
  );
  const selectedCoordinator = eligibleCoordinators.find((coordinator) => coordinator.id === replacementCoordinatorId);
  const replacementRoleOptions = selectedCoordinator
    ? selectedCoordinator.roleTags.map(canonicalCoordinatorRole).filter((role): role is CoordinatorRole => role !== undefined)
    : [...COORDINATOR_ROLES];

  function selectReplacementCoordinator(nextCoordinatorId: string) {
    setReplacementCoordinatorId(nextCoordinatorId);
    const nextCoordinator = coordinators.find((coordinator) => coordinator.id === nextCoordinatorId);
    const candidateRoles = nextCoordinator?.roleTags?.map(canonicalCoordinatorRole).filter(
      (role): role is CoordinatorRole => role !== undefined,
    ) ?? [];
    if (replacementRole && !candidateRoles.includes(replacementRole)) {
      setReplacementRoleState(candidateRoles[0] ?? "");
    }
  }

  async function replace() {
    const role = canonicalCoordinatorRole(replacementRole);
    if (!replacementCoordinatorId || !replacementReason.trim() || !role || !replacementRoleOptions.includes(role)) return;
    await onReplace({
      replacementCoordinatorId,
      role,
      reason: replacementReason.trim(),
    });
    setReplacementCoordinatorId("");
    setReplacementReason("");
  }

  return {
    attendanceStatus,
    eligibleCoordinators,
    replacementCoordinatorId,
    replacementRole,
    replacementRoleOptions,
    canReplace: Boolean(replacementCoordinatorId && replacementReason.trim() && replacementRole && replacementRoleOptions.includes(replacementRole)),
    replacementReason,
    selectReplacementCoordinator,
    setReplacementRole: (value: string) => setReplacementRoleState(canonicalCoordinatorRole(value) ?? ""),
    setReplacementReason,
    replace,
    status: busy ? ("loading" as const) : ("idle" as const),
    error: null,
  };
}
