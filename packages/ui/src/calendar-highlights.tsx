"use client";

import { Fragment, useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { clockLabel } from "./calendar-views";
import { formatPortalDate } from "./format-date";
import type { PortalCalendarItem, PortalCalendarItemRenderer, PortalCalendarKind } from "./portal-calendar";
import { cn } from "./utils";

export function CalendarHighlights<Item extends PortalCalendarItem>({ items, kinds, today, renderItem }: {
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  today: string;
  renderItem: PortalCalendarItemRenderer<Item>;
}) {
  const id = useId();
  // Auto starts open on desktop and closed on phones, without changing the server-rendered markup.
  const [expanded, setExpanded] = useState<boolean | null>(null);
  if (items.length === 0) return null;
  const highlights = [...items].sort((a, b) => {
    const upcomingA = a.date >= today;
    const upcomingB = b.date >= today;
    if (upcomingA !== upcomingB) return upcomingA ? -1 : 1;
    const dateOrder = a.date.localeCompare(b.date);
    return (upcomingA ? dateOrder : -dateOrder) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id.localeCompare(b.id);
  }).slice(0, 3);
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
      <div id={id} role="region" aria-label="Schedule highlights" hidden={expanded === false} className={cn("grid-cols-1 gap-3 pb-2 pt-2 sm:grid-cols-3", expanded === null ? "hidden sm:grid" : expanded ? "grid" : "hidden")}>
        {highlights.map((item) => {
          const kind = kinds[item.kind] ?? { label: item.kind, chip: "bg-muted text-foreground", dot: "bg-muted-foreground" };
          const time = item.startTime ? [clockLabel(item.startTime), item.endTime ? clockLabel(item.endTime) : null].filter(Boolean).join(" – ") : "All day";
          const date = item.date === today ? "Today" : formatPortalDate(item.date);
          return <Fragment key={item.id}>{renderItem({
            item,
            variant: "card",
            title: [item.title, date, time, item.detail].filter(Boolean).join(" · "),
            className: "flex min-w-0 flex-col gap-1 rounded-lg border border-border/70 bg-card bg-linear-to-b from-transparent to-muted/15 p-2.5 text-left shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            children: <><span className="w-full truncate text-sm font-medium text-foreground">{item.title}</span><span className="w-full truncate text-xs text-muted-foreground">{date} · {time}</span><span className={cn("mt-2 flex w-full min-w-0 items-center gap-1.5 rounded px-2 py-1.5 text-xs", kind.chip)}><span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", kind.dot)} /><span className="truncate">{kind.label}</span><ArrowUpRight aria-hidden className="ml-auto size-3.5 shrink-0" /></span></>,
          })}</Fragment>;
        })}
      </div>
    </div>
  );
}
