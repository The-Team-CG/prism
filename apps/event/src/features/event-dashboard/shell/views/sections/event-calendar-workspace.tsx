"use client";

import Link from "next/link";
import { manilaDateKey } from "@prism/ui/format-date";
import type { VisibleRange } from "@prism/ui/calendar-views";
import { PortalCalendar } from "@prism/ui/portal-calendar";
import { Button } from "@prism/ui/components/button";
import { eventRunSheetHref } from "@/features/live-ops/schedule";
import { PMCM_CALENDAR_KINDS, type PmcmCalendarEntry, type PmcmCalendarTarget } from "@/features/pmcm-overview";

const TARGET_ACTIONS: Record<PmcmCalendarTarget, string> = {
  overview: "Open event",
  suppliers: "Open suppliers",
  billing: "Open billing",
};

export function EventCalendarWorkspace({
  items,
  onRangeChange,
  onOpenItem,
}: {
  items: PmcmCalendarEntry[];
  onRangeChange: (range: VisibleRange) => void;
  onOpenItem: (item: PmcmCalendarEntry) => void;
}) {
  const today = manilaDateKey();

  return (
    <PortalCalendar
      items={items}
      kinds={PMCM_CALENDAR_KINDS}
      today={today}
      initialDate={today}
      onRangeChange={onRangeChange}
      detail={{
        action: (item) => {
          const openItem = (
            <Button type="button" variant={item.kind === "schedule_day" ? "outline" : "default"} onClick={() => onOpenItem(item)}>{TARGET_ACTIONS[item.target]}</Button>
          );
          if (!item.scheduleDayId) return openItem;
          const runSheet = (
            <Button asChild variant={item.kind === "schedule_day" ? "default" : "outline"}>
              <Link href={eventRunSheetHref(item.eventId, item.scheduleDayId)}>Open run sheet</Link>
            </Button>
          );
          return item.kind === "schedule_day" ? <>{runSheet}{openItem}</> : <>{openItem}{runSheet}</>;
        },
      }}
    />
  );
}
