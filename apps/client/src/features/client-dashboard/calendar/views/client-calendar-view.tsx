"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { derivePrismLifecycleStage, type PrismEvent } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { EventCover, StageTrack } from "@prism/ui/event-cards";
import { formatPeso } from "@prism/ui/payment-track";
import { PortalCalendar, type PortalCalendarCoverSize, type PortalCalendarFact } from "@prism/ui/portal-calendar";
import { dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import type { ClientDashboardRoute } from "../../workspace/model/client-dashboard-types";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { useEventCoverUrl } from "../../events/view-models/use-event-cover-url";
import { buildClientCalendarItems, clientCalendarFilter, type ClientCalendarItem, type ClientCalendarItemKind } from "../model/client-calendar-items";

const KIND: Record<ClientCalendarItemKind, { label: string; chip: string; dot: string; route: ClientDashboardRoute; action: string }> = {
  event: { label: "Event day", chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary", route: "overview", action: "Open event" },
  payment: { label: "Payment", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention", route: "billing", action: "Open billing" },
  visit: { label: "Site visit", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info", route: "overview", action: "Open event" },
  approval: { label: "Layout approved", chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success", route: "floorplan", action: "Open layout" },
};

type CoverEvent = Pick<PrismEvent, "id" | "eventType" | "coverObjectId">;

function itemHref(item: ClientCalendarItem) {
  return dashboardHref(KIND[item.kind].route, item.eventId);
}

function paymentFacts(item: ClientCalendarItem): PortalCalendarFact[] {
  return [
    ...(item.amount !== undefined ? [{ label: "Amount", value: formatPeso(item.amount) }] : []),
    ...(item.remaining && item.status !== "paid" ? [{ label: "Still to pay", value: formatPeso(item.remaining) }] : []),
    { label: "Status", value: item.look?.label ?? formatStatusLabel(item.status) },
  ];
}

/** What the details panel lists under the event: a payment's amounts, an event day's status and venue, a visit's status. */
function itemFacts(item: ClientCalendarItem, venue: string | undefined): PortalCalendarFact[] {
  if (item.kind === "payment") return paymentFacts(item);
  if (item.kind === "approval") return [];
  return [{ label: "Status", value: formatStatusLabel(item.status) }, ...(item.kind === "event" && venue ? [{ label: "Venue", value: venue }] : [])];
}

function ClientEventCover({ event, size }: { event: CoverEvent; size: PortalCalendarCoverSize }) {
  const imageUrl = useEventCoverUrl(event.id, event.coverObjectId);
  return <EventCover eventType={event.eventType} imageUrl={imageUrl} small={size === "strip"} />;
}

/**
 * The client's calendar on the calendar every portal shares. Older links to one kind of date (payments, site visits…)
 * open it filtered to that kind.
 */
export function ClientCalendarView() {
  const { portalView, state, events } = useClientWorkspace();
  const today = manilaDateKey();
  const items = useMemo(() => (state ? buildClientCalendarItems(state, events) : []), [events, state]);
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  if (!state) return null;
  if (items.length === 0) {
    return <ClientListEmpty icon={CalendarDays} title="Nothing scheduled yet" description="Event dates, payment due dates, site visits and layout approvals appear here once they're set." />;
  }

  const { kind, openOnly } = clientCalendarFilter(portalView);
  const upcoming = items.filter((item) => item.date >= today && (!kind || item.kind === kind) && !(openOnly && item.done));
  const cover = (item: ClientCalendarItem, size: PortalCalendarCoverSize) => {
    const event = byId.get(item.eventId);
    return event ? <ClientEventCover event={event} size={size} /> : null;
  };

  return (
    <PortalCalendar
      key={portalView ?? "all"}
      items={items}
      kinds={KIND}
      today={today}
      initialKind={kind}
      initialOpenOnly={openOnly}
      syncUrl
      initialDate={upcoming[0]?.date ?? today}
      cover={cover}
      detail={{
        facts: (item) => itemFacts(item, byId.get(item.eventId)?.venue),
        body: (item) => {
          const event = item.kind === "event" ? byId.get(item.eventId) : undefined;
          return event ? <StageTrack stage={derivePrismLifecycleStage(event)} /> : null;
        },
        action: (item) => <Button asChild><Link href={itemHref(item)}>{KIND[item.kind].action}</Link></Button>,
      }}
    />
  );
}
