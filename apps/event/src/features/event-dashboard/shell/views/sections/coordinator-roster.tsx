"use client";

import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import type { PrismCoordinator, PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { Search, UsersRound } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { RouteLink, useListFilter } from "@/features/pmcm-kit";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";
import {
  coordinatorAvailabilityState,
  coordinatorBookingsByCoordinator,
  type CoordinatorAvailabilityState,
  type CoordinatorBooking,
  type CoordinatorBookings,
} from "../../model/coordinator-bookings";
import { Card } from "@prism/ui/components/card";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

const ROW_GRID = "sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.4fr)] sm:items-center sm:gap-6";

function rosterEmptyCopy(archived: boolean, searching: boolean) {
  if (searching) return { title: "No coordinator matches", description: "Try a name, a role such as Usher, or a skill." };
  if (archived) return { title: "No archived coordinators", description: "Deactivated coordinators are listed here. Active coordinators stay in the roster." };
  return { title: "No coordinators yet", description: "Coordinators appear here once PMCM adds them to the team." };
}

/** PMCM's coordinators: what each does and where they're booked next. Assignment happens inside each event. */
export function CoordinatorRoster({
  title,
  note,
  archived = false,
  coordinators,
  assignments,
  events,
  onOpenEvent,
}: {
  title: string;
  note?: string;
  /** The archived team view: its empty state talks about deactivated coordinators, not an empty roster. */
  archived?: boolean;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  events: PrismEvent[];
  onOpenEvent: (eventId: string) => void;
}) {
  const [query, setQuery] = useListFilter("q");
  const needle = query.trim().toLowerCase();
  const emptyCopy = rosterEmptyCopy(archived, needle.length > 0);
  const bookings = coordinatorBookingsByCoordinator(assignments, events, manilaDateKey());
  const nextDate = (coordinator: PrismCoordinator) => String(bookings.get(coordinator.id)?.upcoming[0]?.event.eventDate ?? "9999");
  const rows = coordinators
    .filter((coordinator) => [coordinator.name, coordinator.email, ...coordinator.roleTags, ...coordinator.skillsTags].join(" ").toLowerCase().includes(needle))
    .sort((left, right) => Number(right.active) - Number(left.active) || nextDate(left).localeCompare(nextDate(right)) || left.name.localeCompare(right.name));
  const booked = coordinators.filter((coordinator) => (bookings.get(coordinator.id)?.upcoming.length ?? 0) > 0).length;

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

      <Card className="gap-0 block overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>{emptyCopy.title}</EmptyTitle>
              <EmptyDescription>{emptyCopy.description}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden border-b border-border px-4 py-2.5 text-xs text-muted-foreground ${ROW_GRID}`}>
              <span>Coordinator</span>
              <span>Roles and skills</span>
              <span>Next booking</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((coordinator) => (
                <CoordinatorRow
                  key={coordinator.id}
                  coordinator={coordinator}
                  bookings={bookings.get(coordinator.id)}
                  onOpenEvent={onOpenEvent}
                />
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}

function BookingLink({ booking, onOpenEvent }: { booking: CoordinatorBooking; onOpenEvent: (eventId: string) => void }) {
  return (
    <RouteLink
      href={eventWorkspaceHref(booking.event.id, "coordinators")}
      onNavigate={() => onOpenEvent(booking.event.id)}
      className="block truncate font-medium text-foreground hover:text-primary"
    >
      {booking.event.eventName}
    </RouteLink>
  );
}

function BookingSummary({ state, onOpenEvent }: { state: CoordinatorAvailabilityState; onOpenEvent: (eventId: string) => void }) {
  switch (state.kind) {
    case "upcoming":
      return (
        <>
          <BookingLink booking={state.next} onOpenEvent={onOpenEvent} />
          <p className="truncate text-xs text-muted-foreground">
            {formatPortalDate(state.next.event.eventDate)} · {state.next.assignment.role}
            {state.more > 0 ? ` · +${state.more} more` : ""}
          </p>
        </>
      );
    case "past":
      return (
        <>
          <p className="text-muted-foreground">No upcoming bookings</p>
          <p className="truncate text-xs text-muted-foreground">
            Last: {state.last.event.eventName} · {formatPortalDate(state.last.event.eventDate)} · {state.last.assignment.role}
          </p>
        </>
      );
    case "unassigned":
      return <p className="text-muted-foreground">Available, not assigned to an event yet</p>;
    case "inactive":
      return <p className="text-muted-foreground">Not available for bookings</p>;
  }
}

function AssignmentHistory({ bookings, onOpenEvent }: { bookings: CoordinatorBookings; onOpenEvent: (eventId: string) => void }) {
  const all = [...bookings.upcoming, ...bookings.past];
  return (
    <details className="group mt-2 text-xs">
      <summary className="cursor-pointer select-none font-medium text-primary">All assignments ({all.length})</summary>
      <ul className="mt-2 grid gap-1.5">
        {all.map((booking) => (
          <li key={booking.assignment.id} className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
            <BookingLink booking={booking} onOpenEvent={onOpenEvent} />
            <span>{formatPortalDate(booking.event.eventDate)} · {booking.assignment.role} · {booking.assignment.status}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CoordinatorRow({
  coordinator,
  bookings,
  onOpenEvent,
}: {
  coordinator: PrismCoordinator;
  bookings: CoordinatorBookings | undefined;
  onOpenEvent: (eventId: string) => void;
}) {
  const roles = coordinator.roleTags.length ? coordinator.roleTags : ["General coordinator"];
  const state = coordinatorAvailabilityState(coordinator, bookings);
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
        <BookingSummary state={state} onOpenEvent={onOpenEvent} />
        {bookings && bookings.upcoming.length + bookings.past.length > 0 ? <AssignmentHistory bookings={bookings} onOpenEvent={onOpenEvent} /> : null}
      </div>
    </li>
  );
}
