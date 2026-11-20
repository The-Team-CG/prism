import type { CoordinatorRole, PrismCoordinatorAssignment } from "@prism/types";
import { canonicalCoordinatorRole } from "@prism/types";
import { Button } from "@prism/ui/components/button";
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

/** The event's roles as one table: who holds each and whether they have acknowledged, with a way to find someone. */
export function CoordinatorRoleCoverage({ rows, onFind }: { rows: RoleCoverageRow[]; onFind: (role: CoordinatorRole) => void }) {
  if (rows.length === 0) {
    return (
      <section aria-labelledby="role-coverage-title" className="rounded-xl border border-border bg-card px-5 py-4">
        <h2 id="role-coverage-title" className="text-base font-semibold text-foreground">Roles on this event</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nobody is assigned yet. Choose a role below to see who fits and is free.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="role-coverage-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-4">
        <h2 id="role-coverage-title" className="text-base font-semibold text-foreground">Roles on this event</h2>
        <p className="text-sm text-muted-foreground">{roleCoverageSummary(rows)}</p>
      </header>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => {
          const short = row.holders.length < (row.needed ?? 1);
          return (
            <li key={row.role} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              <span className="text-sm font-semibold text-foreground">{row.role}{row.needed !== undefined ? <span className="ml-1.5 font-normal text-muted-foreground">{row.holders.length} of {row.needed}</span> : null}</span>
              <span className="col-start-1 row-start-2 min-w-0 text-sm sm:col-start-auto sm:row-start-auto">
                {row.holders.length === 0 ? <span className="text-attention">Unfilled</span> : row.holders.map((holder, index) => (
                  <span key={holder.id}>
                    {index > 0 ? ", " : null}
                    <span className="text-foreground">{holder.name}</span>
                    <span className={holder.acknowledged ? "text-success" : "text-attention"}> · {holder.acknowledged ? "acknowledged" : "not yet acknowledged"}</span>
                  </span>
                ))}
              </span>
              <Button type="button" size="sm" variant={short ? "default" : "ghost"} className="row-span-2 sm:row-span-1" onClick={() => onFind(row.role)}>
                {short ? "Assign" : "Change"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
