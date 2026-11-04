"use client";

import { useMemo } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { manilaDateKey } from "@prism/ui/format-date";
import { calendarWindow, pmcmCalendar, toCalendarEntries } from "@/features/pmcm-overview";
import { EventCalendarWorkspace } from "./event-calendar-workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardCalendarSectionView() {
  const { events, selectedEvent, navigateEvent } = useEventDashboardLoadedRouteViewModel();
  const window = useMemo(() => calendarWindow(manilaDateKey()), []);
  const calendar = useResource(pmcmCalendar, window);
  const invalidate = useInvalidate();
  const items = useMemo(() => toCalendarEntries(calendar.data?.items ?? []), [calendar.data]);

  if (calendar.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-border bg-card p-5 text-sm">
        <p className="text-foreground">We could not load the calendar.</p>
        <button type="button" onClick={() => void invalidate(pmcmCalendar, window)} className="mt-2 min-h-11 text-sm font-semibold text-primary">Try again</button>
      </div>
    );
  }
  if (calendar.status === "pending") return <p role="status" className="text-sm text-muted-foreground">Loading the calendar…</p>;

  return (
    <EventCalendarWorkspace
      events={events}
      items={items}
      selectedEventId={selectedEvent?.id}
      onOpenItem={(item) => navigateEvent(item.eventId, item.target)}
      onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
    />
  );
}
