import type { PrismCoordinator, PrismCoordinatorAssignment, PrismEvent } from "@prism/types";

const INACTIVE_ASSIGNMENT_STATUSES = ["cancelled", "replaced", "declined"];

export type CoordinatorBooking = { assignment: PrismCoordinatorAssignment; event: PrismEvent };

export type CoordinatorBookings = {
  /** Live assignments on events that have not happened yet, soonest first. */
  upcoming: CoordinatorBooking[];
  /** Live assignments on events whose date has passed (or that are archived), most recent first. */
  past: CoordinatorBooking[];
};

function eventDay(event: PrismEvent) {
  return String(event.eventDate).slice(0, 10);
}

/**
 * Every live assignment, grouped by coordinator and split into upcoming and past. A past event still counts as the
 * coordinator's history: the roster must not call someone free because their last event has already happened.
 */
export function coordinatorBookingsByCoordinator(
  assignments: PrismCoordinatorAssignment[],
  events: PrismEvent[],
  today: string,
): Map<string, CoordinatorBookings> {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const byCoordinator = new Map<string, CoordinatorBookings>();
  for (const assignment of assignments) {
    const event = eventsById.get(assignment.eventId);
    if (!assignment.coordinatorId || !event || INACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)) continue;
    const bookings = byCoordinator.get(assignment.coordinatorId) ?? { upcoming: [], past: [] };
    const isUpcoming = !event.archived && eventDay(event) >= today;
    if (isUpcoming) bookings.upcoming.push({ assignment, event });
    else bookings.past.push({ assignment, event });
    byCoordinator.set(assignment.coordinatorId, bookings);
  }
  for (const bookings of byCoordinator.values()) {
    bookings.upcoming.sort((left, right) => eventDay(left.event).localeCompare(eventDay(right.event)));
    bookings.past.sort((left, right) => eventDay(right.event).localeCompare(eventDay(left.event)));
  }
  return byCoordinator;
}

export type CoordinatorAvailabilityState =
  | { kind: "upcoming"; next: CoordinatorBooking; more: number }
  | { kind: "past"; last: CoordinatorBooking }
  | { kind: "unassigned" }
  | { kind: "inactive" };

/** What the roster's booking column says about one coordinator. Only "upcoming" means booked ahead. */
export function coordinatorAvailabilityState(coordinator: Pick<PrismCoordinator, "active">, bookings: CoordinatorBookings | undefined): CoordinatorAvailabilityState {
  if (!coordinator.active) return { kind: "inactive" };
  const next = bookings?.upcoming[0];
  if (next) return { kind: "upcoming", next, more: (bookings?.upcoming.length ?? 1) - 1 };
  const last = bookings?.past[0];
  if (last) return { kind: "past", last };
  return { kind: "unassigned" };
}

/** The Team › Availability window, in days from today. */
export const AVAILABILITY_DAYS = 14;

export type CoordinatorAvailabilityRow = {
  coordinator: PrismCoordinator;
  /** One cell per day: the live assignments on events held that day. */
  cells: Array<{ date: string; bookings: CoordinatorBooking[] }>;
  /** Live assignments on events in today's calendar month. */
  thisMonth: number;
};

function addDayKeys(start: string, count: number): string[] {
  const first = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => new Date(first + index * 86_400_000).toISOString().slice(0, 10));
}

/**
 * Who is on which event over the next two weeks, one row per coordinator: the grid PMCM checks before assigning
 * anyone inside an event. Rows keep the order they are given in.
 */
export function coordinatorAvailabilityGrid(
  coordinators: PrismCoordinator[],
  assignments: PrismCoordinatorAssignment[],
  events: PrismEvent[],
  today: string,
  days = AVAILABILITY_DAYS,
): { days: string[]; rows: CoordinatorAvailabilityRow[] } {
  const dayKeys = addDayKeys(today, days);
  const bookings = coordinatorBookingsByCoordinator(assignments, events, today);
  const month = today.slice(0, 7);
  const rows = coordinators.map((coordinator) => {
    const all = [...(bookings.get(coordinator.id)?.upcoming ?? []), ...(bookings.get(coordinator.id)?.past ?? [])];
    return {
      coordinator,
      cells: dayKeys.map((date) => ({ date, bookings: all.filter((booking) => eventDay(booking.event) === date) })),
      thisMonth: all.filter((booking) => eventDay(booking.event).slice(0, 7) === month).length,
    };
  });
  return { days: dayKeys, rows };
}
