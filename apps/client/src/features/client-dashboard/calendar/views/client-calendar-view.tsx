"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, MapPinned, WalletCards, type LucideIcon } from "lucide-react";
import { buildCalendarMonthGrid, isDateKeyInMonth, monthLabel, monthOfDateKey, shiftMonth, type CalendarMonth } from "@prism/ui/calendar-grid";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { cn } from "@/app/components/ui/utils";
import { CLIENT_PORTAL_VIEW_META, dashboardHref, formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import type { ClientDashboardRoute } from "../../workspace/model/client-dashboard-types";
import { ClientListEmpty, ClientListSection, type ClientRowTone } from "../../shared/client-list-ui";
import { dueState, eventCountdown } from "../../home/model/client-home-summary";
import { buildClientCalendarItems, type ClientCalendarItem, type ClientCalendarItemKind } from "../model/client-calendar-items";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_CELL = 3;

const KIND: Record<ClientCalendarItemKind, { label: string; icon: LucideIcon; chip: string; dot: string; route: ClientDashboardRoute }> = {
  event: { label: "Event", icon: CalendarDays, chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary", route: "overview" },
  payment: { label: "Payment due", icon: WalletCards, chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention", route: "billing" },
  visit: { label: "Site visit", icon: MapPinned, chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info", route: "overview" },
  approval: { label: "Layout approved", icon: BadgeCheck, chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success", route: "floorplan" },
};

const controlClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted";

function itemHref(item: ClientCalendarItem) {
  return dashboardHref(KIND[item.kind].route, item.eventId);
}

function itemStatus(item: ClientCalendarItem, today: string): { label: string; tone: ClientRowTone } {
  if (item.kind === "payment") {
    if (item.status === "paid") return { label: "Paid", tone: "done" };
    return dueState(item.date, today) ?? { label: formatStatusLabel(item.status), tone: "neutral" };
  }
  if (item.kind === "approval") return { label: "Approved", tone: "done" };
  return { label: eventCountdown(item.date, today) ?? formatPortalDate(item.date), tone: "neutral" };
}

export function ClientCalendarView() {
  const { portalView, state, events } = useClientWorkspace();
  const today = manilaDateKey();
  const items = useMemo(() => (state ? buildClientCalendarItems(state, events, portalView) : []), [events, portalView, state]);
  const firstUpcoming = items.find((item) => item.date >= today)?.date;
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>(() => monthOfDateKey(firstUpcoming ?? today));
  if (!state) return null;

  const byId = new Map(items.map((item) => [item.id, item]));
  const cells = buildCalendarMonthGrid(visibleMonth, items.map((item) => ({ id: item.id, eventDate: item.date })), today);
  const monthItems = items.filter((item) => isDateKeyInMonth(item.date, visibleMonth));
  const upcoming = items.filter((item) => item.date >= today);
  const label = monthLabel(visibleMonth);
  const legend = (Object.keys(KIND) as ClientCalendarItemKind[]).filter((kind) => items.some((item) => item.kind === kind));
  const viewTitle = portalView ? CLIENT_PORTAL_VIEW_META[portalView]?.title : undefined;

  if (items.length === 0) {
    return <ClientListEmpty icon={CalendarDays} title="Nothing scheduled yet" description="Event dates, payment due dates, site visits and layout approvals appear here once they're set." />;
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="client-calendar-month" className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="client-calendar-month" className="text-base font-semibold text-foreground" aria-live="polite">{label}</h2>
            <p className="text-xs text-muted-foreground">{monthItems.length === 1 ? "1 date this month" : `${monthItems.length} dates this month`}</p>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Change month">
            <button type="button" className={controlClass} onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))} aria-label="Previous month"><ChevronLeft className="size-4" aria-hidden /></button>
            <button type="button" className={controlClass} onClick={() => setVisibleMonth(monthOfDateKey(today))}>Today</button>
            <button type="button" className={controlClass} onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))} aria-label="Next month"><ChevronRight className="size-4" aria-hidden /></button>
          </div>
        </header>

        {/* Phone: agenda for the visible month. */}
        <div className="sm:hidden">
          {monthItems.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">Nothing scheduled in {label}.</p>
          ) : (
            <ul className="divide-y divide-border">
              {monthItems.map((item) => (
                <li key={item.id}>
                  <Link href={itemHref(item)} className="flex min-h-11 items-start gap-3 px-4 py-3">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND[item.kind].dot)} />
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">{formatPortalDate(item.date)} · {KIND[item.kind].label}</span>
                      <span className="block break-words text-sm font-semibold text-foreground">{item.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tablet and desktop: month grid. */}
        <div className="hidden p-3 sm:block">
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground" aria-hidden>
            {WEEKDAYS.map((day) => <span key={day} className="px-2">{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1" role="grid" aria-label={label}>
            {cells.map((cell) => {
              if (cell.kind === "blank") return <div key={cell.key} role="gridcell" aria-hidden className="min-h-24 rounded-md bg-muted/40" />;
              const cellItems = cell.eventIds.map((id) => byId.get(id)).filter((item): item is ClientCalendarItem => Boolean(item));
              return (
                <div key={cell.key} role="gridcell" aria-label={`${formatPortalDate(cell.dateKey)}${cellItems.length ? `, ${cellItems.length} scheduled` : ""}`} className="flex min-h-24 min-w-0 flex-col gap-1 rounded-md border border-border bg-background p-1.5">
                  <span className={cell.isToday ? "grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" : "px-0.5 text-xs font-semibold text-foreground"}>{cell.day}</span>
                  {cellItems.slice(0, MAX_PER_CELL).map((item) => (
                    <Link key={item.id} href={itemHref(item)} title={`${item.title} · ${item.detail}`} className={cn("block min-w-0 truncate rounded px-1.5 py-0.5 text-xs font-medium", KIND[item.kind].chip)}>
                      {item.title}
                    </Link>
                  ))}
                  {cellItems.length > MAX_PER_CELL ? <span className="px-0.5 text-xs text-muted-foreground">+{cellItems.length - MAX_PER_CELL} more</span> : null}
                </div>
              );
            })}
          </div>
          {legend.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
              {legend.map((kind) => (
                <span key={kind} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-2 rounded-full", KIND[kind].dot)} />{KIND[kind].label}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <ClientListSection id="client-calendar-upcoming" title={viewTitle ?? (upcoming.length ? "Coming up" : "Recent")} count={(upcoming.length ? upcoming : items).length}>
        {(upcoming.length ? upcoming : [...items].reverse()).slice(0, 8).map((item) => {
          const status = itemStatus(item, today);
          return (
            <ClientCalendarRow key={item.id} item={item} status={status} />
          );
        })}
      </ClientListSection>
    </div>
  );
}

/** Narrow side list: the four-column row would not fit, so date and status share the second line. */
function ClientCalendarRow({ item, status }: { item: ClientCalendarItem; status: { label: string; tone: ClientRowTone } }) {
  const Icon = KIND[item.kind].icon;
  return (
    <li className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised">
      <span aria-hidden className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md", KIND[item.kind].chip)}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <Link href={itemHref(item)} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{item.title}</Link>
        <span className="block truncate text-xs text-muted-foreground">{formatPortalDate(item.date)} · {item.detail}</span>
      </span>
      <span className={cn("shrink-0 whitespace-nowrap text-xs tabular-nums", status.tone === "urgent" ? "font-semibold text-danger" : status.tone === "attention" ? "font-medium text-attention" : status.tone === "done" ? "text-success" : "text-muted-foreground")}>{status.label}</span>
    </li>
  );
}
