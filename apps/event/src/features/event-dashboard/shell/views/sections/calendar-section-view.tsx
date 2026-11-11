"use client";

import { useEffect, useMemo, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { visibleRange, type VisibleRange } from "@prism/ui/calendar-views";
import { manilaDateKey } from "@prism/ui/format-date";
import type { PrismPmcmCalendarItem } from "@prism/types";
import { calendarWindow, pmcmCalendar, toCalendarEntries } from "@/features/pmcm-overview";
import { EventCalendarWorkspace } from "./event-calendar-workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Card } from "@prism/ui/components/card";

export function EventDashboardCalendarSectionView() {
  const { navigateEvent } = useEventDashboardLoadedRouteViewModel();
  const [range, setRange] = useState<VisibleRange>(() => visibleRange("month", manilaDateKey()));
  const window = useMemo(() => calendarWindow(range), [range]);
  const calendar = useResource(pmcmCalendar, window);
  const invalidate = useInvalidate();
  // The calendar stays on screen while the next window loads, so the view and date you chose are kept.
  const [loaded, setLoaded] = useState<PrismPmcmCalendarItem[]>([]);
  useEffect(() => {
    if (calendar.data) setLoaded(calendar.data.items);
  }, [calendar.data]);
  const items = useMemo(() => toCalendarEntries(loaded), [loaded]);

  return (
    <div className="space-y-3">
      {calendar.status === "error" ? (
        <Card role="alert" className="gap-0 block rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-foreground">We could not load these dates.</p>
          <button type="button" onClick={() => void invalidate(pmcmCalendar, window)} className="mt-1 min-h-11 text-sm font-semibold text-primary">Try again</button>
        </Card>
      ) : null}
      {calendar.status === "pending" ? <LoadingState label="Loading dates…" /> : null}
      <EventCalendarWorkspace
        items={items}
        onRangeChange={(next) => setRange((current) => (current.from === next.from && current.to === next.to ? current : next))}
        onOpenItem={(item) => navigateEvent(item.eventId, item.target)}
      />
    </div>
  );
}
