import type { CreateEventDayTaskInput, CreateUrgentIssueInput } from "@prism/types";
import { asIsoDateTime } from "@/features/live-ops/workspace/model/live-ops-workspace-rules";

export function sameCoordinatorName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isCoordinatorAssignmentActive(assignment: { status?: string }): boolean {
  return assignment.status !== "cancelled" && assignment.status !== "replaced";
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

/* ── EP-11-S02: coordinator task and issue logging ──────────────── */

/**
 * Provisional role list, lifted from the PMCM live desk
 * (live-operations-workspace.tsx:270-276). It is NOT canonical: no agreed
 * coordinator role vocabulary exists yet, and this is pending a product
 * decision. Do not source it from COORDINATOR_ROLE_REQUIREMENTS in
 * sample-compatibility.service.ts, which is a dead sample surface carrying
 * its own diverged copy of the role-scoping filter.
 */
const PROVISIONAL_TASK_ROLES = [
  "General Coordinator",
  "Event Day System Operator",
  "Registration Staff",
  "Floor Director",
  "Stage Director",
  "Ingress and Egress Assistant",
  "Usher",
] as const;

/** The literal the backend special-cases at live-ops-read-models.service.ts:72. */
const GENERAL_COORDINATOR = "General Coordinator";

type CoordinatorRoleViewLike = {
  role: string;
  assignment: { coordinatorName: string };
};

function trimmed(value?: string): string {
  return value?.trim() ?? "";
}

/**
 * Assignment role is a free string with no enum on the assign path, so a
 * controlled select whose value is absent from its options renders blank.
 * Prepend the coordinator's own role when the list does not already carry it.
 */
export function taskAssignedRoleOptions(roleView: CoordinatorRoleViewLike): string[] {
  const options = [...PROVISIONAL_TASK_ROLES];
  const own = trimmed(roleView.role);
  if (!own || options.some((role) => sameCoordinatorName(role, own))) return options;
  return [own, ...options];
}

/**
 * True when the task will not come back in this coordinator's own role view.
 * Mirrors the backend filter at live-ops-read-models.service.ts:67-74, which
 * admits a task only if assignedRole matches the coordinator's role, ownerName
 * matches their name, or assignedRole is literally "General Coordinator".
 */
export function isTaskOutsideOwnQueue({
  assignedRole,
  ownRole,
  assignToMe,
}: {
  assignedRole: string;
  ownRole: string;
  assignToMe: boolean;
}): boolean {
  if (assignToMe) return false;
  const role = trimmed(assignedRole);
  if (sameCoordinatorName(role, GENERAL_COORDINATOR)) return false;
  return !sameCoordinatorName(role, trimmed(ownRole));
}

export function buildCoordinatorTaskInput({
  title,
  assignedRole,
  priority,
  notes,
  dueAt,
  assignToMe,
  roleView,
}: {
  title: string;
  assignedRole: string;
  priority?: string;
  notes?: string;
  dueAt?: string;
  assignToMe: boolean;
  roleView: CoordinatorRoleViewLike;
}): CreateEventDayTaskInput {
  const isoDueAt = asIsoDateTime(trimmed(dueAt));
  return {
    title: trimmed(title),
    ...(trimmed(assignedRole) ? { assignedRole: trimmed(assignedRole) } : {}),
    ...(trimmed(priority) ? { priority: trimmed(priority) } : {}),
    ...(trimmed(notes) ? { notes: trimmed(notes) } : {}),
    ...(isoDueAt ? { dueAt: isoDueAt } : {}),
    // Finding 8: the backend compares ownerName against the assignment name,
    // so this must be assignment.coordinatorName and never session.name.
    ...(assignToMe ? { ownerName: roleView.assignment.coordinatorName } : {}),
  };
}

export function buildCoordinatorIssueInput({
  title,
  severity,
  affectedArea,
  description,
  slaDueAt,
  assignToMe,
  roleView,
}: {
  title: string;
  severity?: string;
  affectedArea?: string;
  description?: string;
  slaDueAt?: string;
  assignToMe: boolean;
  roleView: CoordinatorRoleViewLike;
}): CreateUrgentIssueInput {
  const isoSlaDueAt = asIsoDateTime(trimmed(slaDueAt));
  return {
    title: trimmed(title),
    ...(trimmed(severity) ? { severity: trimmed(severity) } : {}),
    ...(trimmed(affectedArea) ? { affectedArea: trimmed(affectedArea) } : {}),
    ...(trimmed(description) ? { description: trimmed(description) } : {}),
    ...(isoSlaDueAt ? { slaDueAt: isoSlaDueAt } : {}),
    // Leaving ownerRole unset keeps the issue in Open triage: the server infers
    // Assigned from ownerRole or ownerName at live-operations.service.ts:195.
    ...(assignToMe
      ? { ownerRole: roleView.role, ownerName: roleView.assignment.coordinatorName }
      : {}),
  };
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
