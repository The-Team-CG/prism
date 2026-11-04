"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { PortalCalendar } from "@prism/ui/portal-calendar";
import type { PrismEvent } from "@prism/types";
import { eventDateKey } from "@prism/ui/calendar-grid";
import { Card, CardHeader } from "./shell-ui";

const EVENT_KINDS = { event: { label: "Event", chip: "bg-primary/10 text-primary hover:bg-primary/15 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground", dot: "bg-primary" } };

export function EventCalendarWorkspace({
  events,
  selectedEventId,
  onOpenEvent,
}: {
  events: PrismEvent[];
  selectedEventId?: string | null;
  onOpenEvent: (id: string) => void;
}) {
  const today = manilaDateKey();

  const datedEvents = useMemo(
    () =>
      events
        .map((event) => ({ event, dateKey: eventDateKey(event.eventDate) }))
        .filter((item): item is { event: PrismEvent; dateKey: string } => item.dateKey !== null)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    [events],
  );
  const upcoming = datedEvents.filter((item) => item.dateKey >= today);
  const schedule = (upcoming.length ? upcoming : datedEvents).slice(0, 6);
  const items = datedEvents.map(({ event, dateKey }) => ({ id: event.id, date: dateKey, title: event.eventName, kind: "event" }));

  return (
    <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <PortalCalendar
        items={items}
        kinds={EVENT_KINDS}
        today={today}
        initialDate={today}
        renderItem={({ item, className, style, title, children }) => (
          <button type="button" title={title} style={style} onClick={() => onOpenEvent(item.id)} data-active={item.id === selectedEventId} className={className}>
            {children}
          </button>
        )}
      />

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
