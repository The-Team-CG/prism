import { useMemo, useState } from "react";

import type {
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
  const [replacementRole, setReplacementRole] = useState(assignment.role);
  const [replacementReason, setReplacementReason] = useState("");

  const attendanceStatus = assignment.attendanceStatus ?? "pending";
  const eligibleCoordinators = useMemo(
    () => coordinators.filter((coordinator) => coordinator.id !== assignment.coordinatorId && coordinator.active),
    [assignment.coordinatorId, coordinators],
  );

  function selectReplacementCoordinator(nextCoordinatorId: string) {
    setReplacementCoordinatorId(nextCoordinatorId);
    const nextCoordinator = coordinators.find((coordinator) => coordinator.id === nextCoordinatorId);
    if (nextCoordinator?.roleTags?.length && !nextCoordinator.roleTags.includes(replacementRole)) {
      setReplacementRole(nextCoordinator.roleTags[0]);
    }
  }

  async function replace() {
    if (!replacementCoordinatorId || !replacementReason.trim()) return;
    await onReplace({
      replacementCoordinatorId,
      role: replacementRole || assignment.role,
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
    replacementReason,
    selectReplacementCoordinator,
    setReplacementRole,
    setReplacementReason,
    replace,
    status: busy ? ("loading" as const) : ("idle" as const),
    error: null,
  };
}
