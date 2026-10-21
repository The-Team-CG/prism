"use client";

import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatShortDate } from "@/features/pmcm-kit/model/formatters";
import type { PrismEvent } from "@prism/types";
import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";


export function EventCalendarWorkspace({
  events,
  selectedEventId,
  onOpenEvent,
}: {
  events: PrismEvent[];
  selectedEventId?: string | null;
  onOpenEvent: (id: string) => void;
}) {
  const sortedEvents = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const upcoming = sortedEvents.filter((event) => new Date(event.eventDate).getTime() >= Date.now()).slice(0, 6);
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calendarDays = Array.from({ length: 35 }, (_, index) => index + 1);
  const eventDaySet = new Set(
    events
      .map((event) => new Date(event.eventDate))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.getDate()),
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionAccent>PMCM calendar</SectionAccent>
              <h2 className="mt-1 text-base font-black text-foreground">{monthLabel}</h2>
            </div>
            <StatusBadge status={`${events.length} events`} />
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => (
              <div
                key={day}
                className="flex aspect-square min-h-16 flex-col justify-between rounded-md border border-border bg-background p-2 text-left"
              >
                <span className="text-xs font-black text-foreground">{day}</span>
                {eventDaySet.has(day) ? <span className="h-1.5 w-8 rounded-full bg-primary" /> : null}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-black text-foreground">Upcoming schedule</h2>
        </CardHeader>
        <div className="divide-y divide-border">
          {(upcoming.length ? upcoming : sortedEvents).slice(0, 6).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event.id)}
              data-active={event.id === selectedEventId}
              className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-muted/30 data-[active=true]:bg-primary/5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-black text-primary">
                {formatShortDate(event.eventDate).split(" ").slice(0, 2).join(" ")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-foreground">{event.eventName}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{event.clientName}</span>
                <span className="mt-2 inline-flex"><StatusBadge status={event.status} /></span>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}

