"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  MapPinned,
  WalletCards,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { cn } from "@/app/components/ui/utils";
import type { PrismBillingStatement, PrismBriefing, PrismEvent } from "@prism/types";
import {
  eventDateParts,
  formatEventDate,
  formatStatusLabel,
} from "../../model/client-dashboard-view-rules";

export function NoticeBanner({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  const cls = tone === "danger"
    ? "border-primary/20 bg-primary/8 text-primary border-l-primary"
    : "border-success/20 bg-success/8 text-success border-l-success";
  return (
    <div className={`rounded-lg border border-l-4 px-4 py-3 text-sm leading-6 ${cls}`}>{children}</div>
  );
}

export function EventSummaryCard({
  event,
  dots,
  billingStatement,
  briefing,
  documentCount,
  onOpen,
  onOpenFloorplan,
  floorplanActionLabel,
  className,
}: {
  event: PrismEvent;
  dots: Array<{ label: string; done: boolean }>;
  billingStatement?: PrismBillingStatement;
  briefing?: PrismBriefing;
  documentCount: number;
  onOpen: () => void;
  onOpenFloorplan?: () => void;
  floorplanActionLabel: string;
  className?: string;
}) {
  const dateParts = eventDateParts(event.eventDate);

  return (
    <article className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="bg-ink px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-md bg-white px-3 py-2 text-center text-ink">
            <p className="text-lg font-black leading-none">{dateParts.day}</p>
            <p className="mt-1 text-3xs font-black uppercase leading-none">{dateParts.month}</p>
          </div>
          <StatusBadge status={event.status} label={formatStatusLabel(event.status)} />
        </div>
        <div className="mt-8">
          <h3 className="line-clamp-2 text-lg font-black leading-tight">{event.eventName}</h3>
          <p className="mt-1 text-xs font-semibold text-white/70">{event.clientName}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" />
            <span className="truncate">{formatEventDate(event.eventDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPinned className="size-4 shrink-0" />
            <span className="truncate">{briefing?.venue ?? "Venue pending"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <WalletCards className="size-4 shrink-0" />
            <span className="truncate">{billingStatement ? formatStatusLabel(billingStatement.status) : "Billing pending"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="size-4 shrink-0" />
            <span className="truncate">{documentCount} document{documentCount === 1 ? "" : "s"} on file</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dots.map((dot) => (
            <span
              key={dot.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs font-semibold",
                dot.done
                  ? "border-success/20 bg-success/8 text-success"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", dot.done ? "bg-success" : "bg-muted-foreground/35")} />
              {dot.label}
            </span>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full rounded-lg font-bold" onClick={onOpen}>
            Open workspace <ArrowRight className="size-3.5" />
          </Button>
          {onOpenFloorplan && (
            <Button variant="outline" className="w-full rounded-lg font-bold" onClick={onOpenFloorplan}>
              {floorplanActionLabel} <MapPinned className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function FieldGroup({ label: labelText, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold text-muted-foreground">
        {labelText}
      </Label>
      {children}
    </div>
  );
}
