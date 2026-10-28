"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import {
  buildCalendarMonthGrid,
  eventDateKey,
  isDateKeyInMonth,
  monthLabel,
  monthOfDateKey,
  shiftMonth,
  todayDateKey,
  type CalendarMonth,
} from "../../model/event-calendar-grid";
import { Card, CardBody, CardHeader } from "./shell-ui";

const WEEKDAYS = [
  { short: "Sun", long: "Sunday" },
  { short: "Mon", long: "Monday" },
  { short: "Tue", long: "Tuesday" },
  { short: "Wed", long: "Wednesday" },
  { short: "Thu", long: "Thursday" },
  { short: "Fri", long: "Friday" },
  { short: "Sat", long: "Saturday" },
];
const MAX_EVENTS_PER_CELL = 2;

const controlClass =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-muted sm:h-9 sm:min-w-9";

export function EventCalendarWorkspace({
  events,
  selectedEventId,
  onOpenEvent,
}: {
  events: PrismEvent[];
  selectedEventId?: string | null;
  onOpenEvent: (id: string) => void;
}) {
  const today = todayDateKey();
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>(() => monthOfDateKey(today));

  const datedEvents = useMemo(
    () =>
      events
        .map((event) => ({ event, dateKey: eventDateKey(event.eventDate) }))
        .filter((item): item is { event: PrismEvent; dateKey: string } => item.dateKey !== null)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    [events],
  );
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const cells = useMemo(() => buildCalendarMonthGrid(visibleMonth, events, today), [events, today, visibleMonth]);
  const monthEvents = datedEvents.filter((item) => isDateKeyInMonth(item.dateKey, visibleMonth));
  const upcoming = datedEvents.filter((item) => item.dateKey >= today);
  const schedule = (upcoming.length ? upcoming : datedEvents).slice(0, 6);
  const label = monthLabel(visibleMonth);

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground" aria-live="polite">{label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {monthEvents.length === 1 ? "1 event this month" : `${monthEvents.length} events this month`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Change month">
              <button type="button" className={controlClass} onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))} aria-label="Previous month">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button type="button" className={controlClass} onClick={() => setVisibleMonth(monthOfDateKey(today))}>
                Today
              </button>
              <button type="button" className={controlClass} onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))} aria-label="Next month">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="px-4 sm:px-6">
          {/* Phone: agenda list for the visible month. */}
          <div className="sm:hidden">
            {monthEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled in {label}.</p>
            ) : (
              <ul className="divide-y divide-border">
                {monthEvents.map(({ event, dateKey }) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onOpenEvent(event.id)}
                      data-active={event.id === selectedEventId}
                      title={event.eventName}
                      className="flex min-h-11 w-full min-w-0 flex-col items-start gap-0.5 py-3 text-left data-[active=true]:text-primary"
                    >
                      <span className="text-xs text-muted-foreground">{formatPortalDate(dateKey)}</span>
                      <span className="w-full break-words text-sm font-semibold text-foreground">{event.eventName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tablet and desktop: month grid. */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 gap-1 text-left text-xs text-muted-foreground" aria-hidden>
              {WEEKDAYS.map((day) => (
                <span key={day.short} className="px-2">{day.short}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1" role="grid" aria-label={label}>
              {cells.map((cell, index) => {
                if (cell.kind === "blank") {
                  return <div key={cell.key} role="gridcell" aria-hidden className="min-h-20 rounded-md bg-muted/40" />;
                }
                const cellEvents = cell.eventIds.map((id) => eventsById.get(id)).filter((event): event is PrismEvent => Boolean(event));
                const hidden = cellEvents.length - MAX_EVENTS_PER_CELL;
                return (
                  <div
                    key={cell.key}
                    role="gridcell"
                    aria-label={`${WEEKDAYS[index % 7].long}, ${formatPortalDate(cell.dateKey)}${cellEvents.length ? `, ${cellEvents.length} event${cellEvents.length === 1 ? "" : "s"}` : ""}`}
                    data-date={cell.dateKey}
                    className="flex min-h-20 min-w-0 flex-col gap-1 rounded-md border border-border bg-background p-1.5"
                  >
                    <span
                      className={
                        cell.isToday
                          ? "grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                          : "px-0.5 text-xs font-semibold text-foreground"
                      }
                    >
                      {cell.day}
                    </span>
                    {cellEvents.slice(0, MAX_EVENTS_PER_CELL).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        title={event.eventName}
                        onClick={() => onOpenEvent(event.id)}
                        data-active={event.id === selectedEventId}
                        className="block w-full min-w-0 truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-xs font-medium text-primary hover:bg-primary/15 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                      >
                        {event.eventName}
                      </button>
                    ))}
                    {hidden > 0 ? <span className="px-0.5 text-xs text-muted-foreground">+{hidden} more</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">{upcoming.length ? "Upcoming schedule" : "Recent schedule"}</h2>
        </CardHeader>
        {schedule.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">No dated events yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {schedule.map(({ event, dateKey }) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(event.id)}
                  data-active={event.id === selectedEventId}
                  title={event.eventName}
                  className="flex min-h-11 w-full min-w-0 flex-col items-start gap-1 px-6 py-4 text-left transition hover:bg-muted/30 data-[active=true]:bg-primary/5"
                >
                  <span className="text-xs tabular-nums text-muted-foreground">{formatPortalDate(dateKey)}</span>
                  <span className="w-full break-words text-sm font-semibold text-foreground">{event.eventName}</span>
                  <span className="flex w-full min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground" title={event.clientName}>{event.clientName || "—"}</span>
                    <StatusBadge status={event.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
