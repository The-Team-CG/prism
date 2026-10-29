"use client";

import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import type { PrismCoordinator, PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { Search, UsersRound } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { RouteLink, useListFilter } from "@/features/pmcm-kit";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";

const INACTIVE_ASSIGNMENT_STATUSES = ["cancelled", "replaced", "declined"];

type UpcomingAssignment = { assignment: PrismCoordinatorAssignment; event: PrismEvent };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

/** Live assignments on events that haven't happened yet, soonest first, grouped by coordinator. */
function upcomingAssignmentsByCoordinator(assignments: PrismCoordinatorAssignment[], events: PrismEvent[]) {
  const today = manilaDateKey();
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const byCoordinator = new Map<string, UpcomingAssignment[]>();
  for (const assignment of assignments) {
    const event = eventsById.get(assignment.eventId);
    if (!assignment.coordinatorId || !event || event.archived || INACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)) continue;
    if (String(event.eventDate).slice(0, 10) < today) continue;
    byCoordinator.set(assignment.coordinatorId, [...(byCoordinator.get(assignment.coordinatorId) ?? []), { assignment, event }]);
  }
  for (const list of byCoordinator.values()) list.sort((left, right) => String(left.event.eventDate).localeCompare(String(right.event.eventDate)));
  return byCoordinator;
}

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.4fr)] sm:items-center sm:gap-6";

/** PMCM's coordinators: what each does and where they're booked next. Assignment happens inside each event. */
export function CoordinatorRoster({
  title,
  note,
  coordinators,
  assignments,
  events,
  onOpenEvent,
}: {
  title: string;
  note?: string;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  events: PrismEvent[];
  onOpenEvent: (eventId: string) => void;
}) {
  const [query, setQuery] = useListFilter("q");
  const needle = query.trim().toLowerCase();
  const upcoming = upcomingAssignmentsByCoordinator(assignments, events);
  const nextDate = (coordinator: PrismCoordinator) => String(upcoming.get(coordinator.id)?.[0]?.event.eventDate ?? "9999");
  const rows = coordinators
    .filter((coordinator) => [coordinator.name, coordinator.email, ...coordinator.roleTags, ...coordinator.skillsTags].join(" ").toLowerCase().includes(needle))
    .sort((left, right) => Number(right.active) - Number(left.active) || nextDate(left).localeCompare(nextDate(right)) || left.name.localeCompare(right.name));
  const booked = coordinators.filter((coordinator) => upcoming.has(coordinator.id)).length;

  return (
    <section aria-labelledby="coordinator-roster-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="coordinator-roster-title" className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {note ?? `${coordinators.length} ${coordinators.length === 1 ? "coordinator" : "coordinators"} · ${booked} booked on upcoming events`}
          </p>
        </div>
        <label className="relative w-full sm:max-w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, role or skill"
            aria-label="Search by name, role or skill"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UsersRound}
              title={needle ? "No coordinator matches" : "No coordinators yet"}
              description={needle ? "Try a name, a role such as Usher, or a skill." : "Coordinators appear here once PMCM adds them to the team."}
            />
          </div>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden border-b border-border px-4 py-2.5 text-xs text-muted-foreground ${ROW_GRID}`}>
              <span>Coordinator</span>
              <span>Roles and skills</span>
              <span>Next booking</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((coordinator) => (
                <CoordinatorRow key={coordinator.id} coordinator={coordinator} upcoming={upcoming.get(coordinator.id) ?? []} onOpenEvent={onOpenEvent} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function CoordinatorRow({ coordinator, upcoming, onOpenEvent }: { coordinator: PrismCoordinator; upcoming: UpcomingAssignment[]; onOpenEvent: (eventId: string) => void }) {
  const next = upcoming[0];
  const roles = coordinator.roleTags.length ? coordinator.roleTags : ["General coordinator"];
  return (
    <li className={`grid gap-3 px-4 py-3.5 ${ROW_GRID} ${coordinator.active ? "" : "bg-muted/40"}`}>
      <div className="flex min-w-0 items-center gap-3">
        {coordinator.photoUrl ? (
          <img src={coordinator.photoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(coordinator.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground">{coordinator.name}</span>
            {coordinator.active ? null : <StatusBadge status="inactive" />}
          </p>
          {coordinator.email ? (
            <a href={`mailto:${coordinator.email}`} className="block truncate text-xs text-muted-foreground hover:text-primary">{coordinator.email}</a>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 pl-12 sm:pl-0">
        <ul aria-label="Roles" className="flex flex-wrap gap-1.5">
          {roles.map((role) => (
            <li key={role} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{role}</li>
          ))}
        </ul>
        {coordinator.skillsTags.length > 0 ? (
          <p className="mt-1.5 truncate text-xs text-muted-foreground" title={coordinator.skillsTags.join(", ")}>{coordinator.skillsTags.join(" · ")}</p>
        ) : null}
      </div>

      <div className="min-w-0 pl-12 text-sm sm:pl-0">
        {next ? (
          <>
            <RouteLink
              href={eventWorkspaceHref(next.event.id, "coordinators")}
              onNavigate={() => onOpenEvent(next.event.id)}
              className="block truncate font-medium text-foreground hover:text-primary"
            >
              {next.event.eventName}
            </RouteLink>
            <p className="truncate text-xs text-muted-foreground">
              {formatPortalDate(next.event.eventDate)} · {next.assignment.role}
              {upcoming.length > 1 ? ` · +${upcoming.length - 1} more` : ""}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{coordinator.active ? "Free, no upcoming bookings" : "Not available for bookings"}</p>
        )}
      </div>
    </li>
  );
}
