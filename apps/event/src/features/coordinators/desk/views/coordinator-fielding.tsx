import type { CoordinatorRole, PrismCoordinator, PrismCoordinatorAssignment } from "@prism/types";
import { COORDINATOR_ROLES, canonicalCoordinatorRole } from "@prism/types";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";
import { cx } from "@/features/pmcm-kit";
import { isCoordinatorAssignmentActive } from "../model/coordinators-desk-rules";
import type { RoleCoverageRow } from "./coordinator-role-coverage";

type Identity = Pick<PrismCoordinator, "id" | "name">;

/** The catalog roles a coordinator is tagged for, in catalog order. */
export function taggedRoles(coordinator: Pick<PrismCoordinator, "roleTags">): CoordinatorRole[] {
  const tags = new Set((Array.isArray(coordinator.roleTags) ? coordinator.roleTags : []).map((tag) => canonicalCoordinatorRole(tag)).filter(Boolean));
  return COORDINATOR_ROLES.filter((role) => tags.has(role));
}

/** Roles the event still needs come first in a menu, so the likely choice is at the top. */
function orderForMenu(roles: CoordinatorRole[], short: Set<string>, preferred?: CoordinatorRole) {
  return [...roles].sort((a, b) => Number(b === preferred) - Number(a === preferred) || Number(short.has(b)) - Number(short.has(a)));
}

/** Closes the menu a choice was made in. */
function closeMenu(event: SyntheticEvent) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

function Menu({ label, summary, primary = false, children }: { label: string; summary: ReactNode; primary?: boolean; children: ReactNode }) {
  return (
    <details className="relative">
      <summary
        aria-label={label}
        className={cx(
          "inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md px-3 text-sm font-semibold",
          primary ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border bg-card text-foreground hover:bg-surface-raised",
        )}
      >
        {summary}
      </summary>
      <div className="absolute right-0 z-20 mt-1 grid w-64 gap-0.5 rounded-lg border border-border bg-popover p-1 text-sm shadow-lg">{children}</div>
    </details>
  );
}

function MenuItem({ label, detail, tone, disabled, onSelect }: { label: string; detail?: string; tone?: "open" | "muted"; disabled?: boolean; onSelect: (event: SyntheticEvent) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-surface-raised disabled:opacity-60"
    >
      <span className="font-medium text-foreground">{label}</span>
      {detail ? <span className={cx("shrink-0 text-xs", tone === "open" ? "text-attention" : "text-muted-foreground")}>{detail}</span> : null}
    </button>
  );
}

/** The roles the event needs as chips: filled in green, short in amber; a chip narrows the list to that role. */
export function RoleNeedChips({ rows, active, onPick }: { rows: RoleCoverageRow[]; active: CoordinatorRole | "all"; onPick: (role: CoordinatorRole | "all") => void }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nobody is fielded yet. Pick a coordinator below and choose their role.</p>;
  return (
    <div role="group" aria-label="Roles on this event" className="flex flex-wrap gap-2">
      {rows.map((row) => {
        const short = Math.max(0, (row.needed ?? 1) - row.holders.length);
        const on = active === row.role;
        return (
          <button
            key={row.role}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? "all" : row.role)}
            className={cx(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              short ? "border-attention/30 bg-attention-soft text-attention" : "border-success/30 bg-success-soft text-success",
              on && "ring-2 ring-ring",
            )}
          >
            {row.role}{short ? ` · ${short} short` : " ✓"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Fielding coordinators person-first: every active coordinator once, with the roles they are tagged for, whether
 * they are free on the event date, and what they hold here. One action per person: "Field as" for someone not on
 * the event (roles the event is short of first), or a menu to move or add a role for someone already on it.
 * It replaces role cards that listed the same coordinator once per tagged role.
 */
export function CoordinatorFieldingList({
  coordinators,
  eventAssignments,
  conflictFor,
  roleFilter,
  coverage,
  eventDateLabel,
  busy,
  onField,
  onMove,
}: {
  coordinators: PrismCoordinator[];
  eventAssignments: PrismCoordinatorAssignment[];
  conflictFor: (coordinatorId: string) => PrismCoordinatorAssignment | undefined;
  roleFilter: CoordinatorRole | "all";
  coverage: RoleCoverageRow[];
  eventDateLabel: string;
  busy: boolean;
  onField: (coordinator: Identity, role: CoordinatorRole) => void;
  onMove?: (assignmentId: string, role: CoordinatorRole) => Promise<void>;
}) {
  const short = new Set(coverage.filter((row) => row.holders.length < (row.needed ?? 1)).map((row) => row.role));
  const holderOf = new Map(coverage.map((row) => [row.role, row.holders.map((holder) => holder.name).join(", ")]));
  const preferred = roleFilter === "all" ? undefined : roleFilter;
  return (
    <ul className="divide-y divide-border">
      {coordinators.map((coordinator) => {
        const roles = taggedRoles(coordinator);
        const holdings = eventAssignments.filter((assignment) => assignment.coordinatorId === coordinator.id && isCoordinatorAssignmentActive(assignment));
        const held = new Set(holdings.map((assignment) => canonicalCoordinatorRole(assignment.role) ?? assignment.role));
        const conflict = conflictFor(coordinator.id);
        const free = orderForMenu(roles.filter((role) => !held.has(role)), short, preferred);
        const roleDetail = (role: CoordinatorRole) => (short.has(role) ? "open" : holderOf.get(role) ? `has ${holderOf.get(role)}` : undefined);
        return (
          <li key={coordinator.id} role="group" aria-label={coordinator.name} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[2.25rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] sm:items-center">
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{coordinator.name.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{coordinator.name}</p>
              <p className="truncate text-xs text-muted-foreground" title={roles.join(", ")}>{roles.join(" · ") || "No role tags yet"}</p>
              {coordinator.skillsTags.length ? <p className="truncate text-xs text-muted-foreground">Skills: {coordinator.skillsTags.join(", ")}</p> : null}
            </div>
            <p className={cx("col-start-2 text-xs font-medium sm:col-start-auto sm:text-sm", conflict ? "text-attention" : "text-success")}>
              {conflict ? `On ${conflict.conflictEventName ?? "another event"}` : `Free ${eventDateLabel}`}
            </p>
            <div className="col-start-2 min-w-0 text-xs sm:col-start-auto sm:text-sm">
              {holdings.length === 0 ? <span className="text-muted-foreground">Not fielded</span> : holdings.map((assignment) => (
                <p key={assignment.id} className="truncate">
                  <span className="font-medium text-foreground">{canonicalCoordinatorRole(assignment.role) ?? assignment.role}</span>
                  <span className={assignment.status === "acknowledged" ? "text-success" : "text-attention"}> · {assignment.status === "acknowledged" ? "acknowledged" : "not yet acknowledged"}</span>
                </p>
              ))}
            </div>
            <div className="col-start-3 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
              {holdings.length === 0 ? (
                free.length ? (
                  <Menu label={`Field ${coordinator.name}`} primary summary={<>Field as<ChevronDown aria-hidden className="size-4" /></>}>
                    <p className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">Field {coordinator.name} as</p>
                    {free.map((role) => (
                      <MenuItem key={role} label={role} detail={roleDetail(role)} tone={short.has(role) ? "open" : "muted"} disabled={busy} onSelect={(event) => { closeMenu(event); onField(coordinator, role); }} />
                    ))}
                  </Menu>
                ) : <span className="text-xs text-muted-foreground">No role tags</span>
              ) : (
                <Menu label={`Change ${coordinator.name}`} summary={<MoreHorizontal aria-hidden className="size-4" />}>
                  {onMove ? holdings.flatMap((assignment) => {
                    const from = canonicalCoordinatorRole(assignment.role) ?? assignment.role;
                    return free.map((role) => (
                      <button
                        key={`${assignment.id}-${role}`}
                        type="button"
                        disabled={busy}
                        aria-label={`Move ${coordinator.name} from ${from} to ${role}`}
                        onClick={(event) => { closeMenu(event); void onMove(assignment.id, role); }}
                        className="rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-raised disabled:opacity-60"
                      >
                        Move to <span className="font-medium">{role}</span>
                      </button>
                    ));
                  }) : null}
                  {free.map((role) => (
                    <button
                      key={`add-${role}`}
                      type="button"
                      disabled={busy}
                      aria-label={`Also field ${coordinator.name} as ${role}`}
                      onClick={(event) => { closeMenu(event); onField(coordinator, role); }}
                      className="rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-raised disabled:opacity-60"
                    >
                      Also field as <span className="font-medium">{role}</span>
                    </button>
                  ))}
                  {free.length === 0 ? <p className="px-2.5 py-2 text-xs text-muted-foreground">No other role they are tagged for.</p> : null}
                </Menu>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
