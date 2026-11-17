"use client";

import { useMemo } from "react";
import Link from "next/link";
import { derivePrismLifecycleStage, type PrismEvent } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import type { VisibleRange } from "@prism/ui/calendar-views";
import { EventCover, StageTrack } from "@prism/ui/event-cards";
import { formatPeso } from "@prism/ui/payment-track";
import { PortalCalendar, type PortalCalendarCoverSize, type PortalCalendarFact } from "@prism/ui/portal-calendar";
import { Button } from "@prism/ui/components/button";
import { eventRunSheetHref } from "@/features/live-ops/schedule";
import { PMCM_CALENDAR_KINDS, useEventCoverUrl, type PmcmCalendarEntry, type PmcmCalendarTarget } from "@/features/pmcm-overview";

const TARGET_ACTIONS: Record<PmcmCalendarTarget, string> = {
  overview: "Open event",
  suppliers: "Open suppliers",
  billing: "Open billing",
};

/** What the calendar knows about each event beyond its entries: who it is for, where, its stage and its picture. */
export type PmcmCalendarEvent = Pick<PrismEvent, "id" | "clientName" | "status">
  & Partial<Pick<PrismEvent, "venue" | "eventType" | "coverObjectId" | "archived" | "actualEndedAt" | "clientPortalStatus" | "proposalClientStatus">>;

function PmcmEventCover({ event, size }: { event: PmcmCalendarEvent; size: PortalCalendarCoverSize }) {
  const imageUrl = useEventCoverUrl(event.id, event.coverObjectId);
  return <EventCover eventType={event.eventType} imageUrl={imageUrl} small={size === "strip"} />;
}

function entryFacts(item: PmcmCalendarEntry, event: PmcmCalendarEvent | undefined): PortalCalendarFact[] {
  if (!event) return [];
  return [
    ...(item.amount !== undefined ? [{ label: "Amount due", value: formatPeso(item.amount) }] : []),
    ...(event.clientName ? [{ label: "Client", value: event.clientName }] : []),
    ...(item.kind === "event" && event.venue ? [{ label: "Venue", value: event.venue }] : []),
  ];
}

function EntryActions({ item, onOpenItem }: { item: PmcmCalendarEntry; onOpenItem: (item: PmcmCalendarEntry) => void }) {
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
}

export function EventCalendarWorkspace({
  items,
  events = [],
  onRangeChange,
  onOpenItem,
}: {
  items: PmcmCalendarEntry[];
  events?: PmcmCalendarEvent[];
  onRangeChange: (range: VisibleRange) => void;
  onOpenItem: (item: PmcmCalendarEntry) => void;
}) {
  const today = manilaDateKey();
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const cover = (item: PmcmCalendarEntry, size: PortalCalendarCoverSize) => {
    const event = byId.get(item.eventId);
    return event ? <PmcmEventCover event={event} size={size} /> : null;
  };

  return (
    <PortalCalendar
      items={items}
      kinds={PMCM_CALENDAR_KINDS}
      today={today}
      initialDate={today}
      syncUrl
      onRangeChange={onRangeChange}
      cover={cover}
      detail={{
        facts: (item) => entryFacts(item, byId.get(item.eventId)),
        body: (item) => {
          const event = item.kind === "event" ? byId.get(item.eventId) : undefined;
          return event ? <StageTrack stage={derivePrismLifecycleStage(event)} /> : null;
        },
        action: (item) => <EntryActions item={item} onOpenItem={onOpenItem} />,
      }}
    />
  );
}
