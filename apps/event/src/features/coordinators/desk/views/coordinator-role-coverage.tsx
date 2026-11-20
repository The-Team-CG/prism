import type { CoordinatorRole, PrismCoordinatorAssignment } from "@prism/types";
import { canonicalCoordinatorRole } from "@prism/types";
import { isCoordinatorAssignmentActive } from "../model/coordinators-desk-rules";

export type RoleCoverageRow = {
  role: CoordinatorRole;
  holders: Array<{ id: string; name: string; acknowledged: boolean }>;
  /** How many the role needs, when PMCM set a coverage target for it. */
  needed?: number;
};

/**
 * Who holds each role on this event: every role with a coverage target or an assignment, in catalog order. A role
 * with a target counts as filled once enough people hold it; one without counts as filled with one holder.
 */
export function roleCoverageRows(
  roles: readonly CoordinatorRole[],
  eventAssignments: PrismCoordinatorAssignment[],
  targets: Array<{ role: string; required: number }>,
): RoleCoverageRow[] {
  const active = eventAssignments.filter(isCoordinatorAssignmentActive);
  return roles
    .map((role) => {
      const target = targets.find((entry) => canonicalCoordinatorRole(entry.role) === role);
      const holders = active
        .filter((assignment) => canonicalCoordinatorRole(assignment.role) === role)
        .map((assignment) => ({ id: assignment.id, name: assignment.coordinatorName, acknowledged: assignment.status === "acknowledged" }));
      return { role, holders, needed: target?.required };
    })
    .filter((row) => row.holders.length > 0 || row.needed !== undefined);
}

export function roleCoverageSummary(rows: RoleCoverageRow[]): string {
  const filled = rows.filter((row) => row.holders.length >= (row.needed ?? 1)).length;
  const waiting = rows.reduce((sum, row) => sum + row.holders.filter((holder) => !holder.acknowledged).length, 0);
  return [`${filled} of ${rows.length} ${rows.length === 1 ? "role" : "roles"} filled`, waiting ? `${waiting} not yet acknowledged` : null].filter(Boolean).join(" · ");
}
