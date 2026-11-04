"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildCalendarMonthGrid, isDateKeyInMonth, monthLabel, monthOfDateKey, shiftMonth, type CalendarMonth } from "./calendar-grid";
import { formatPortalDate } from "./format-date";
import { cn } from "./utils";

const WEEKDAYS = [
  { short: "Sun", long: "Sunday" },
  { short: "Mon", long: "Monday" },
  { short: "Tue", long: "Tuesday" },
  { short: "Wed", long: "Wednesday" },
  { short: "Thu", long: "Thursday" },
  { short: "Fri", long: "Friday" },
  { short: "Sat", long: "Saturday" },
];

const controlClass =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted sm:h-9 sm:min-w-9";

export type PortalCalendarItem = {
  id: string;
  date: string;
  title: string;
  /** Shorter text for the narrow month cell; the full title stays in the tooltip. */
  chipLabel?: string;
  detail?: string;
  kind: string;
};
export type PortalCalendarKind = { label: string; chip: string; dot: string };

/** Portals own navigation: each renders the link or button for an item with the class it is given. */
export type PortalCalendarItemRenderer<Item extends PortalCalendarItem> = (input: {
  item: Item;
  variant: "chip" | "agenda";
  className: string;
  title: string;
  children: ReactNode;
}) => ReactNode;

export type PortalMonthCalendarProps<Item extends PortalCalendarItem> = {
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  /** Today's Philippine calendar date (YYYY-MM-DD). */
  today: string;
  initialMonth: CalendarMonth;
  /** Singular name of what is counted in the month heading. */
  noun?: string;
  maxPerCell?: number;
  className?: string;
  renderItem: PortalCalendarItemRenderer<Item>;
};

/**
 * A month of dated items: a seven-column grid from tablet up, an agenda list on phones.
 * Role-neutral: portals decide which items exist and where each one leads.
 */
export function PortalMonthCalendar<Item extends PortalCalendarItem>({
  items,
  kinds,
  today,
  initialMonth,
  noun = "date",
  maxPerCell = 3,
  className,
  renderItem,
}: PortalMonthCalendarProps<Item>) {
  const headingId = useId();
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>(initialMonth);
  const byId = new Map(items.map((item) => [item.id, item]));
  const cells = buildCalendarMonthGrid(visibleMonth, items.map((item) => ({ id: item.id, eventDate: item.date })), today);
  const monthItems = items.filter((item) => isDateKeyInMonth(item.date, visibleMonth));
  const label = monthLabel(visibleMonth);
  const legend = Object.keys(kinds).filter((kind) => items.some((item) => item.kind === kind));

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-foreground" aria-live="polite">{label}</h2>
          <p className="text-xs text-muted-foreground">{monthItems.length === 1 ? `1 ${noun} this month` : `${monthItems.length} ${noun}s this month`}</p>
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
                {renderItem({
                  item,
                  variant: "agenda",
                  title: item.detail ? `${item.title} · ${item.detail}` : item.title,
                  className: "flex min-h-11 w-full min-w-0 items-start gap-3 px-4 py-3 text-left",
                  children: (
                    <>
                      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", kinds[item.kind]?.dot)} />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">{formatPortalDate(item.date)} · {kinds[item.kind]?.label}</span>
                        <span className="block break-words text-sm font-semibold text-foreground">{item.title}</span>
                      </span>
                    </>
                  ),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tablet and desktop: month grid. */}
      <div className="hidden p-3 sm:block">
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((day) => <span key={day.short} className="px-2">{day.short}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1" role="grid" aria-label={label}>
          {cells.map((cell, index) => {
            if (cell.kind === "blank") return <div key={cell.key} role="gridcell" aria-hidden className="min-h-24 rounded-md bg-muted/40" />;
            const cellItems = cell.eventIds.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item));
            return (
              <div
                key={cell.key}
                role="gridcell"
                data-date={cell.dateKey}
                aria-label={`${WEEKDAYS[index % 7].long}, ${formatPortalDate(cell.dateKey)}${cellItems.length ? `, ${cellItems.length} scheduled` : ""}`}
                className="flex min-h-24 min-w-0 flex-col gap-1 rounded-md border border-border bg-background p-1.5"
              >
                <span className={cell.isToday ? "grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" : "px-0.5 text-xs font-semibold text-foreground"}>{cell.day}</span>
                {cellItems.slice(0, maxPerCell).map((item) => (
                  <Fragment key={item.id}>
                    {renderItem({
                      item,
                      variant: "chip",
                      title: item.detail ? `${item.title} · ${item.detail}` : item.title,
                      className: cn("block w-full min-w-0 truncate rounded px-1.5 py-0.5 text-left text-xs font-medium", kinds[item.kind]?.chip),
                      children: item.chipLabel ?? item.title,
                    })}
                  </Fragment>
                ))}
                {cellItems.length > maxPerCell ? <span className="px-0.5 text-xs text-muted-foreground">+{cellItems.length - maxPerCell} more</span> : null}
              </div>
            );
          })}
        </div>
        {legend.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
            {legend.map((kind) => (
              <span key={kind} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-2 rounded-full", kinds[kind].dot)} />{kinds[kind].label}</span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
