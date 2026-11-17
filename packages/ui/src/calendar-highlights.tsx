"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { clockLabel } from "./calendar-views";
import { formatPortalDate } from "./format-date";
import type { PortalCalendarItem, PortalCalendarItemRenderer, PortalCalendarKind } from "./portal-calendar";
import { cn } from "./utils";

/** An item's own look laid over its kind's, for the chip, the dot and the name a highlight or details panel shows. */
export function lookOf(kinds: Record<string, PortalCalendarKind>, item: PortalCalendarItem): PortalCalendarKind {
  const kind = kinds[item.kind] ?? { label: item.kind, chip: "bg-muted text-foreground", dot: "bg-muted-foreground" };
  return { ...kind, ...item.look };
}

const byWhen = (a: PortalCalendarItem, b: PortalCalendarItem) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id.localeCompare(b.id);

/**
 * What the highlights show, in the order the home work lists use: anything overdue first (oldest first, wherever its
 * date falls), then what is coming up soonest. The next event day always keeps a place. With nothing overdue or ahead,
 * the most recent entries stand in, so a finished calendar still shows where it left off.
 */
export function pickCalendarHighlights<Item extends PortalCalendarItem>(items: Item[], today: string, eventKind = "event", limit = 3): Item[] {
  const overdue = items.filter((item) => item.overdue).sort(byWhen);
  const upcoming = items.filter((item) => !item.overdue && item.date >= today).sort(byWhen);
  const picked = [...overdue, ...upcoming].slice(0, limit);
  if (picked.length === 0) return [...items].sort((a, b) => byWhen(b, a)).slice(0, limit);
  const nextEvent = upcoming.find((item) => item.kind === eventKind);
  if (nextEvent && !picked.includes(nextEvent)) picked[picked.length - 1] = nextEvent;
  return picked;
}

export function CalendarHighlights<Item extends PortalCalendarItem>({ items, kinds, today, eventKind, cover, renderItem }: {
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  today: string;
  eventKind?: string;
  cover?: (item: Item) => ReactNode;
  renderItem: PortalCalendarItemRenderer<Item>;
}) {
  const id = useId();
  // Auto starts open on desktop and closed on phones, without changing the server-rendered markup.
  const [expanded, setExpanded] = useState<boolean | null>(null);
  if (items.length === 0) return null;
  const highlights = pickCalendarHighlights(items, today, eventKind);
  const toggle = (isExpanded: boolean, className: string) => (
    <button type="button" aria-controls={id} aria-expanded={isExpanded} onClick={() => setExpanded(!isExpanded)} className={cn("min-h-8 items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {isExpanded ? "Hide highlights" : "Show highlights"}<ChevronDown aria-hidden className={cn("size-3.5", isExpanded && "rotate-180")} />
    </button>
  );
  return (
    <div className="border-b border-border/60 px-4 py-2 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Highlights <span className="ml-1 font-normal tabular-nums">{highlights.length}</span></p>
        {toggle(expanded ?? true, "hidden sm:inline-flex")}
        {toggle(expanded ?? false, "inline-flex sm:hidden")}
      </div>
      <div id={id} role="region" aria-label="Schedule highlights" hidden={expanded === false} className={cn("grid-cols-1 items-start gap-3 pb-2 pt-2 sm:grid-cols-3", expanded === null ? "hidden sm:grid" : expanded ? "grid" : "hidden")}>
        {highlights.map((item) => {
          const kind = lookOf(kinds, item);
          const time = item.startTime ? [clockLabel(item.startTime), item.endTime ? clockLabel(item.endTime) : null].filter(Boolean).join(" – ") : "All day";
          const date = item.date === today ? "Today" : formatPortalDate(item.date);
          const picture = item.kind === (eventKind ?? "event") ? cover?.(item) : null;
          return <Fragment key={item.id}>{renderItem({
            item,
            variant: "card",
            title: [item.title, item.eventName, date, time, item.detail].filter(Boolean).join(" · "),
            className: "flex min-w-0 flex-col gap-1 overflow-hidden rounded-lg border border-border/70 bg-card bg-linear-to-b from-transparent to-muted/15 p-2.5 text-left shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            children: <>{picture ? <span className="-mx-2.5 -mt-2.5 mb-1 block">{picture}</span> : null}<span className="w-full truncate text-sm font-medium text-foreground">{item.title}</span>{item.eventName ? <span className="w-full truncate text-xs text-foreground/80">{item.eventName}</span> : null}<span className="mb-1 w-full truncate text-xs text-muted-foreground">{date} · {time}</span><span className={cn("mt-auto flex w-full min-w-0 items-center gap-1.5 rounded px-2 py-1.5 text-xs", kind.chip)}><span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", kind.dot)} /><span className="truncate">{kind.label}</span><ArrowUpRight aria-hidden className="ml-auto size-3.5 shrink-0" /></span></>,
          })}</Fragment>;
        })}
      </div>
    </div>
  );
}
