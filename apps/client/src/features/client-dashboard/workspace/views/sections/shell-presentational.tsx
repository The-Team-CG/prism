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
import type { ClientSidebarSubItem } from "../../model/client-dashboard-types";
import {
  eventDateParts,
  formatEventDate,
  formatStatusLabel,
} from "../../model/client-dashboard-view-rules";

export function NoticeBanner({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  const cls = tone === "danger"
    ? "border-(--prism-signal)/20 bg-(--prism-signal)/8 text-(--prism-signal) border-l-(--prism-signal)"
    : "border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success) border-l-(--prism-success)";
  return (
    <div className={`rounded-lg border border-l-4 px-4 py-3 text-sm leading-6 ${cls}`}>{children}</div>
  );
}

export function PageHeader({ eyebrow, title, description, meta, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: Array<string | React.ReactNode>;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-black uppercase text-muted-foreground">{eyebrow}</p> : null}
          <h2 className="mt-0.5 text-lg font-black leading-tight text-foreground sm:text-xl">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p> : null}
          {meta?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((item, i) =>
                typeof item === "string"
                  ? <span key={i} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground">{item}</span>
                  : <span key={i}>{item}</span>
              )}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function EventWorkspaceNav({
  items,
  activeItemId,
  onSelect,
}: {
  items: ClientSidebarSubItem[];
  activeItemId: string;
  onSelect: (item: ClientSidebarSubItem) => void;
}) {
  return (
    <nav aria-label="Selected event sections" className="border-t border-border">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center px-2">
          {items.map((item) => {
            const active = item.id === activeItemId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "relative h-11 shrink-0 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-(--prism-signal)",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-(--prism-signal)" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
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
      <div className="bg-(--prism-ink) px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-md bg-white px-3 py-2 text-center text-(--prism-ink)">
            <p className="text-lg font-black leading-none">{dateParts.day}</p>
            <p className="mt-1 text-[10px] font-black uppercase leading-none">{dateParts.month}</p>
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
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold",
                dot.done
                  ? "border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success)"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", dot.done ? "bg-(--prism-success)" : "bg-muted-foreground/35")} />
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
