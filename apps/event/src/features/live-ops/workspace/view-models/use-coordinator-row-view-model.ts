import { useMemo, useState } from "react";
import { COORDINATOR_ROLES, canonicalCoordinatorRole } from "@prism/types";

import type {
  CoordinatorRole,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorSuggestion,
  ReplaceCoordinatorAssignmentInput,
} from "@prism/types";

type CoordinatorRowViewModelProps = {
  assignment: PrismCoordinatorAssignment;
  coordinators: PrismCoordinator[];
  busy: boolean;
  onReplace: (input: ReplaceCoordinatorAssignmentInput) => Promise<void>;
  onLoadSuggestions: (role: CoordinatorRole, skills: string[]) => Promise<PrismCoordinatorSuggestion[]>;
};

export function useCoordinatorRowViewModel({
  assignment,
  coordinators,
  busy,
  onReplace,
  onLoadSuggestions,
}: CoordinatorRowViewModelProps) {
  const [replacementCoordinatorId, setReplacementCoordinatorId] = useState("");
  const [replacementRole, setReplacementRoleState] = useState<CoordinatorRole | "">(
    canonicalCoordinatorRole(assignment.role) ?? "",
  );
  const [replacementReason, setReplacementReason] = useState("");
  const [replacementSuggestions, setReplacementSuggestions] = useState<PrismCoordinatorSuggestion[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "loaded" | "empty" | "error">("idle");

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

  async function findReplacementSuggestions() {
    const role = canonicalCoordinatorRole(replacementRole);
    if (!role) return;
    setSuggestionStatus("loading");
    setReplacementSuggestions([]);
    try {
      const suggestions = await onLoadSuggestions(role, []);
      setReplacementSuggestions(suggestions);
      setSuggestionStatus(suggestions.length > 0 ? "loaded" : "empty");
    } catch {
      setSuggestionStatus("error");
    }
  }

  function setReplacementRole(value: string) {
    setReplacementRoleState(canonicalCoordinatorRole(value) ?? "");
    setReplacementSuggestions([]);
    setSuggestionStatus("idle");
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
    replacementSuggestions,
    suggestionStatus,
    canReplace: Boolean(replacementCoordinatorId && replacementReason.trim() && replacementRole && replacementRoleOptions.includes(replacementRole)),
    replacementReason,
    selectReplacementCoordinator,
    setReplacementRole,
    findReplacementSuggestions,
    setReplacementReason,
    replace,
    status: busy ? ("loading" as const) : ("idle" as const),
    error: null,
  };
}
