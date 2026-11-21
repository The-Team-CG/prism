"use client";

import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import type { PrismCoordinator, PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { RouteLink, cx } from "@/features/pmcm-kit";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";
import { AVAILABILITY_DAYS, coordinatorAvailabilityGrid } from "../../model/coordinator-bookings";

function dayLabel(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "UTC" }).format(day),
    day: new Intl.DateTimeFormat("en-PH", { day: "numeric", timeZone: "UTC" }).format(day),
    weekend: day.getUTCDay() === 0 || day.getUTCDay() === 6,
  };
}

/**
 * Who is free over the next two weeks, before PMCM assigns anyone inside an event: one row per active coordinator,
 * one column per day, a filled cell where they are on an event (its name on hover and for screen readers, a link to
 * that event's team page), and how many events each has this month.
 */
export function CoordinatorAvailability({
  coordinators,
  assignments,
  events,
  onOpenEvent,
}: {
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  events: PrismEvent[];
  onOpenEvent: (eventId: string) => void;
}) {
  const today = manilaDateKey();
  const grid = coordinatorAvailabilityGrid(coordinators.filter((coordinator) => coordinator.active), assignments, events, today);
  const last = grid.days.at(-1) ?? today;
  return (
    <section aria-labelledby="coordinator-availability-title" className="grid min-w-0 gap-3">
      <div>
        <h2 id="coordinator-availability-title" className="text-base font-semibold text-foreground">Next {AVAILABILITY_DAYS} days</h2>
        <p className="text-sm text-muted-foreground">{formatPortalDate(today)} to {formatPortalDate(last)}. A filled day is an event the coordinator is assigned to; select it to open that event's team.</p>
      </div>
      {/* relative: the cells' screen-reader text is absolutely placed and must scroll with the table, not widen the page. */}
      <div className="relative w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 z-[1] bg-card px-4 py-2 text-left font-medium">Coordinator</th>
              {grid.days.map((date) => {
                const label = dayLabel(date);
                return (
                  <th key={date} scope="col" className={cx("px-0.5 py-2 text-center font-medium", label.weekend && "text-foreground")}>
                    <span className="block">{label.weekday}</span>
                    <span className="block tabular-nums">{label.day}</span>
                  </th>
                );
              })}
              <th scope="col" className="px-4 py-2 text-right font-medium">This month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grid.rows.map((row) => (
              <tr key={row.coordinator.id}>
                <th scope="row" className="sticky left-0 z-[1] bg-card px-4 py-2.5 text-left font-normal">
                  <span className="block truncate font-semibold text-foreground">{row.coordinator.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.coordinator.roleTags.join(" · ") || "General coordinator"}</span>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.date} className="px-0.5 py-2.5">
                    {cell.bookings.length ? (
                      <RouteLink
                        href={eventWorkspaceHref(cell.bookings[0].event.id, "coordinators")}
                        onNavigate={() => onOpenEvent(cell.bookings[0].event.id)}
                        className="block h-6 rounded-md bg-primary transition-opacity hover:opacity-80"
                      >
                        <span className="sr-only">{`${formatPortalDate(cell.date)}: ${cell.bookings.map((booking) => `${booking.event.eventName} (${booking.assignment.role})`).join(", ")}`}</span>
                        <span aria-hidden title={cell.bookings.map((booking) => `${booking.event.eventName} · ${booking.assignment.role}`).join("\n")} className="block h-full" />
                      </RouteLink>
                    ) : (
                      <span aria-hidden className="block h-6 rounded-md bg-muted" />
                    )}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{row.thisMonth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grid.rows.length === 0 ? <p className="text-sm text-muted-foreground">No active coordinators yet.</p> : null}
    </section>
  );
}
