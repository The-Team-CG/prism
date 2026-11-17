"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { EventCover } from "@prism/ui/event-cards";
import { formatPeso } from "@prism/ui/payment-track";
import { PortalCalendar, type PortalCalendarFact, type PortalCalendarKind } from "@prism/ui/portal-calendar";
import { Card, CardContent } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { buildSupplierCalendarItems, type SupplierCalendarItem, type SupplierCalendarItemKind } from "../../model/supplier-calendar-items";
import type { PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useEventCoverUrl } from "../../view-models/use-event-cover-url";

const KINDS: Record<SupplierCalendarItemKind, PortalCalendarKind> = {
  event: { label: "Event day", chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary" },
  deadline: { label: "Quote deadline", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  arrival: { label: "Arrival", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info" },
  departure: { label: "Departure", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info" },
  deliverable: { label: "Deliverable", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  payment: { label: "Payment", chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success" },
};

/** One verb per place: the booking, the quote request, or Payments. */
const ACTIONS: Record<SupplierCalendarItemKind, string> = {
  event: "Open booking",
  deadline: "Open request",
  arrival: "Open booking",
  departure: "Open booking",
  deliverable: "Open booking",
  payment: "Open payments",
};

type CoverSource = { eventType?: string | null; coverObjectId?: string | null };

function itemFacts(item: SupplierCalendarItem): PortalCalendarFact[] {
  return [
    ...(item.category ? [{ label: "For", value: item.category }] : []),
    ...(item.amount !== undefined ? [{ label: "Still to receive", value: formatPeso(item.amount) }] : []),
    ...(item.look?.label ? [{ label: "Status", value: item.look.label }] : []),
  ];
}

function SupplierEventCover({ eventId, source }: { eventId: string; source: CoverSource }) {
  const imageUrl = useEventCoverUrl(eventId, source.coverObjectId);
  return <EventCover eventType={source.eventType} imageUrl={imageUrl} />;
}

export function CalendarPage({ workspace, readinessBoard, workflowWorkspace }: {
  workspace: SupplierWorkspace;
  readinessBoard: PrismSupplierReadinessBoard | null;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
}) {
  const items = useMemo(() => buildSupplierCalendarItems(workspace, readinessBoard, workflowWorkspace), [readinessBoard, workflowWorkspace, workspace]);
  const covers = useMemo(() => new Map((readinessBoard?.items ?? []).map((item) => [item.eventId, item as CoverSource])), [readinessBoard]);
  const today = manilaDateKey();
  const upcoming = items.filter((item) => item.date >= today);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty className="border-0 p-6 md:p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
              <EmptyTitle>Nothing scheduled yet</EmptyTitle>
              <EmptyDescription>Event days, quote deadlines, arrivals, deliverables and payments appear here once they&apos;re set.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const cover = (item: SupplierCalendarItem) => {
    const source = covers.get(item.eventId);
    return source ? <SupplierEventCover eventId={item.eventId} source={source} /> : null;
  };

  return (
    <div className="space-y-3">
      {!readinessBoard ? <p role="status" className="text-sm text-muted-foreground">We could not load your event days. Use Refresh above to try again.</p> : null}
      <PortalCalendar
        items={items}
        kinds={KINDS}
        today={today}
        initialDate={upcoming[0]?.date ?? today}
        cover={cover}
        detail={{
          facts: itemFacts,
          action: (item) => <Button asChild><Link href={item.href}>{ACTIONS[item.kind]}</Link></Button>,
        }}
      />
    </div>
  );
}
