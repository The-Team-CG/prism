"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { clockLabel } from "@prism/ui/calendar-views";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { PortalCalendar, type PortalCalendarKind } from "@prism/ui/portal-calendar";
import { EmptyState } from "@prism/ui/components/empty-state";
import { buildSupplierCalendarItems, type SupplierCalendarItemKind } from "../../model/supplier-calendar-items";
import type { PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody } from "./shell-ui";

const UPCOMING_LIMIT = 8;

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
      <Card><CardBody>
        <EmptyState icon={CalendarDays} title="Nothing scheduled yet" description="Event days, quote deadlines, arrivals, deliverables and payments appear here once they're set." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-3">
      {!readinessBoard ? <p role="status" className="text-sm text-muted-foreground">We could not load your event days. Use Refresh above to try again.</p> : null}
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <PortalCalendar
          items={items}
          kinds={KINDS}
          today={today}
          initialDate={upcoming[0]?.date ?? today}
          detail={{
            action: (item) => <Button asChild><Link href={item.href}>{ACTIONS[item.kind]}</Link></Button>,
          }}
        />
        <Card className="min-w-0 self-start">
          <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">Coming up</h2>
          {upcoming.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">Nothing else is scheduled.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.slice(0, UPCOMING_LIMIT).map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="block min-h-11 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary">
                    <span className="block text-xs text-muted-foreground">{formatPortalDate(item.date)}{item.startTime ? ` · ${clockLabel(item.startTime)}` : ""} · {KINDS[item.kind].label}</span>
                    <span className="block break-words text-sm font-semibold text-foreground">{item.title}</span>
                    <span className="block break-words text-xs text-muted-foreground">{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
