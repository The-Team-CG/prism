"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { PortalCalendar, type PortalCalendarKind } from "@prism/ui/portal-calendar";
import { Card, CardContent } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { buildSupplierCalendarItems, type SupplierCalendarItemKind } from "../../model/supplier-calendar-items";
import type { PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";

const KINDS: Record<SupplierCalendarItemKind, PortalCalendarKind> = {
  event: { label: "Event day", chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary" },
  deadline: { label: "Quote deadline", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  arrival: { label: "Arrival", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info" },
  departure: { label: "Departure", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info" },
  deliverable: { label: "Deliverable", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  payment: { label: "Payment", chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success" },
};

const ACTIONS: Record<SupplierCalendarItemKind, string> = {
  event: "Open details",
  deadline: "Open request",
  arrival: "Open booking",
  departure: "Open booking",
  deliverable: "Open booking",
  payment: "Open payments",
};

export function CalendarPage({ workspace, readinessBoard, workflowWorkspace }: {
  workspace: SupplierWorkspace;
  readinessBoard: PrismSupplierReadinessBoard | null;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
}) {
  const items = useMemo(() => buildSupplierCalendarItems(workspace, readinessBoard, workflowWorkspace), [readinessBoard, workflowWorkspace, workspace]);
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

  return (
    <div className="space-y-3">
      {!readinessBoard ? <p role="status" className="text-sm text-muted-foreground">We could not load your event days. Use Refresh above to try again.</p> : null}
      <PortalCalendar
        items={items}
        kinds={KINDS}
        today={today}
        initialDate={upcoming[0]?.date ?? today}
        detail={{
          action: (item) => <Button asChild><Link href={item.href}>{ACTIONS[item.kind]}</Link></Button>,
        }}
      />
    </div>
  );
}
