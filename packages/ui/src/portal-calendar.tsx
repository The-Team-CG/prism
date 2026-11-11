"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { monthOfDateKey } from "./calendar-grid";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import {
  AGENDA_DAYS,
  CALENDAR_VIEWS,
  addDays,
  clockLabel,
  layoutOverlaps,
  minutesOf,
  monthWeeks,
  periodTitle,
  shiftAnchor,
  spanOf,
  visibleRange,
  weekDateKeys,
  type CalendarViewId,
  type VisibleRange,
} from "./calendar-views";
import { Button } from "./components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger } from "./components/ui/dropdown-menu";
import { formatPortalDate } from "./format-date";
import { cn } from "./utils";

type CalendarTiming = "all" | "timed" | "all-day";
const TIMING_FILTERS = [{ id: "all", label: "All entries" }, { id: "timed", label: "Timed entries" }, { id: "all-day", label: "All-day entries" }] satisfies Array<{ id: CalendarTiming; label: string }>;

const HOUR_PX = 72;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_MONTH_CHIPS = 3;

export type PortalCalendarItem = {
  id: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  title: string;
  /** Shorter text for a narrow month cell; the full title stays in the tooltip. */
  chipLabel?: string;
  /** Second line in the agenda and day views: a place, an owner, an amount. */
  detail?: string;
  kind: string;
  /** Philippine wall-clock time, HH:mm. Items without one are all-day. */
  startTime?: string;
  endTime?: string;
};
export type PortalCalendarKind = { label: string; chip: string; dot: string };

/** Portals own navigation: each renders the link or button for an item with the class and style it is given. */
export type PortalCalendarItemRenderer<Item extends PortalCalendarItem> = (input: {
  item: Item;
  variant: "chip" | "block" | "card";
  className: string;
  style?: CSSProperties;
  title: string;
  children: ReactNode;
}) => ReactNode;

/** Opt-in details panel: clicking an item opens it in a side panel instead of navigating straight away. */
export type PortalCalendarDetail<Item extends PortalCalendarItem> = {
  /** Portal content shown under the item's own date, time and detail. */
  body?: (item: Item) => ReactNode;
  /** The portal's link or button that leaves the calendar for the place the item is handled. */
  action?: (item: Item) => ReactNode;
};

type PortalCalendarNavigation<Item extends PortalCalendarItem> =
  | { renderItem: PortalCalendarItemRenderer<Item>; detail?: undefined }
  | { renderItem?: undefined; detail: PortalCalendarDetail<Item> };

export type PortalCalendarProps<Item extends PortalCalendarItem> = PortalCalendarNavigation<Item> & {
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  /** Today's Philippine calendar date (YYYY-MM-DD). */
  today: string;
  /** The date the calendar opens on. */
  initialDate: string;
  initialView?: CalendarViewId;
  /** Singular name of what is counted, for the month cell labels. */
  noun?: string;
  className?: string;
  /** Optional role-owned category navigation, including existing deep links. */
  categoryControls?: ReactNode;
  /** Called with the dates on screen when the calendar opens and whenever the view or period changes. */
  onRangeChange?: (range: VisibleRange) => void;
};

type ViewProps<Item extends PortalCalendarItem> = {
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  today: string;
  renderItem: PortalCalendarItemRenderer<Item>;
};

const chipBase = "w-full min-w-0 line-clamp-2 break-words rounded px-1.5 py-0.5 text-left text-xs font-medium";
const kindOf = (kinds: Record<string, PortalCalendarKind>, kind: string) => kinds[kind] ?? { label: kind, chip: "bg-muted text-foreground", dot: "bg-muted-foreground" };
const timeRange = (item: PortalCalendarItem) => (item.startTime ? [clockLabel(item.startTime), item.endTime ? clockLabel(item.endTime) : null].filter(Boolean).join(" – ") : "All day");
const tooltip = (item: PortalCalendarItem) => [item.title, item.startTime ? timeRange(item) : null, item.detail].filter(Boolean).join(" · ");

function itemsByDate<Item extends PortalCalendarItem>(items: Item[]) {
  const byDate = new Map<string, Item[]>();
  for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  for (const list of byDate.values()) list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return byDate;
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** A calendar with month, week, day and agenda views. Role-neutral: portals decide which items exist and where each leads. */
export function PortalCalendar<Item extends PortalCalendarItem>({ items, kinds, today, initialDate, initialView = "week", className, categoryControls, onRangeChange, renderItem, detail }: PortalCalendarProps<Item>) {
  const headingId = useId();
  const [view, setView] = useState<CalendarViewId>(initialView);
  const [anchor, setAnchor] = useState(initialDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const [timing, setTiming] = useState<CalendarTiming>("all");
  const [showHighlights, setShowHighlights] = useState(true);
  const matchingItems = useMemo(() => items.filter((item) => {
    const matchesText = [item.title, item.detail, item.chipLabel, kindOf(kinds, item.kind).label].filter(Boolean).join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesText && (timing === "all" || (timing === "timed" ? Boolean(item.startTime) : !item.startTime));
  }), [items, kinds, query, timing]);
  const filteredItems = useMemo(() => matchingItems.filter((item) => activeKind === null || item.kind === activeKind), [matchingItems, activeKind]);
  const byDate = useMemo(() => itemsByDate(filteredItems), [filteredItems]);
  const legend = Object.keys(kinds).filter((kind) => items.some((item) => item.kind === kind));
  const selected = detail ? items.find((item) => item.id === selectedId) ?? null : null;

  useEffect(() => {
    if (selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const match = CALENDAR_VIEWS.find((entry) => entry.shortcut.toLowerCase() === event.key.toLowerCase());
      if (match) setView(match.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const selectChip: PortalCalendarItemRenderer<Item> = ({ item, className: chipClass, style, title, children }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" style={style} className={chipClass} aria-haspopup="dialog" onClick={() => setSelectedId(item.id)}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );

  const range = visibleRange(view, anchor);
  const rangeLabel = view === "week" || view === "agenda" ? `${formatPortalDate(range.from)} – ${formatPortalDate(range.to)}` : periodTitle(view, anchor);
  useEffect(() => {
    onRangeChange?.({ from: range.from, to: range.to });
  }, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDay = (dateKey: string) => {
    setAnchor(dateKey);
    setView("day");
  };
  const renderCalendarItem = renderItem ?? selectChip;
  const viewProps = { items: filteredItems, kinds, today, renderItem: renderCalendarItem };
  const inPeriod = (item: Item) => view === "month" ? item.date.startsWith(anchor.slice(0, 7)) : item.date >= range.from && item.date <= range.to;
  const highlights = [...filteredItems].filter(inPeriod).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "")).slice(0, 4);
  const periodItems = matchingItems.filter(inPeriod);

  return (
    <TooltipProvider delayDuration={300}>
    <section aria-labelledby={headingId} className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(today)}>Today</Button>
          <div className="flex items-center" role="group" aria-label="Change period">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous period" onClick={() => setAnchor((current) => shiftAnchor(view, current, -1))}><ChevronLeft className="size-4" aria-hidden /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Next period" onClick={() => setAnchor((current) => shiftAnchor(view, current, 1))}><ChevronRight className="size-4" aria-hidden /></Button>
          </div>
          <ViewSwitcher view={view} onChange={setView} />
          <Popover>
            <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Choose calendar date" className="max-w-full"><CalendarDays aria-hidden className="size-4" /><span className="truncate">{rangeLabel}</span></Button></PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-2"><label htmlFor={`${headingId}-date`} className="text-sm font-medium">Jump to date</label><input id={`${headingId}-date`} type="date" min="1000-01-01" max="9998-12-31" value={anchor} onChange={(event) => { if (event.target.value && event.target.validity.valid) setAnchor(event.target.value); }} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" /></PopoverContent>
          </Popover>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-sm">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input type="search" aria-label="Search schedule" placeholder="Search schedule..." value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none" />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Filter schedule timing"><SlidersHorizontal aria-hidden className="size-4" />{timing === "all" ? "Filter" : timing === "timed" ? "Timed" : "All day"}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">{TIMING_FILTERS.map((option) => <DropdownMenuItem key={option.id} onSelect={() => setTiming(option.id)}>{option.label}{timing === option.id ? <Check aria-hidden className="ml-auto size-4" /> : null}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h2 id={headingId} aria-live="polite" className="sr-only">{rangeLabel}</h2>
      </header>
      <div className="mx-4 mt-4 flex items-start gap-2 border-b border-border pb-3 sm:mx-5">
        <div role="group" aria-label="Schedule categories" className="flex min-w-0 flex-1 flex-wrap gap-1">
          {categoryControls ?? [{ id: null, label: "All scheduled" }, ...legend.map((id) => ({ id, label: kinds[id].label }))].map((kind) => <button key={kind.id ?? "all"} type="button" aria-pressed={activeKind === kind.id} onClick={() => setActiveKind(kind.id)} className="inline-flex min-h-8 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground">{kind.id ? <span aria-hidden className={cn("size-1.5 rounded-full", kinds[kind.id].dot)} /> : null}{kind.label}<span className="tabular-nums text-muted-foreground">{periodItems.filter((item) => kind.id === null || item.kind === kind.id).length}</span></button>)}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={showHighlights ? "Hide schedule highlights" : "Show schedule highlights"} aria-expanded={showHighlights} onClick={() => setShowHighlights((current) => !current)}><ChevronDown aria-hidden className={cn("size-4 transition-transform", showHighlights && "rotate-180")} /></Button>
      </div>
      {showHighlights && highlights.length > 0 ? <div role="region" aria-label="Schedule highlights" className="flex gap-3 overflow-x-auto px-4 py-4 sm:grid sm:grid-cols-2 sm:px-5 xl:grid-cols-4">{highlights.map((item) => <Fragment key={item.id}>{renderCalendarItem({ item, variant: "card", title: tooltip(item), className: "flex w-64 shrink-0 min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:w-auto text-left transition-colors hover:bg-muted/30", children: <><span className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</span><span className="text-xs text-muted-foreground">{formatPortalDate(item.date)} · {timeRange(item)}</span><span className={cn("mt-auto flex items-center gap-1.5 rounded px-2 py-1 text-xs", kindOf(kinds, item.kind).chip)}><span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", kindOf(kinds, item.kind).dot)} />{kindOf(kinds, item.kind).label}</span></> })}</Fragment>)}</div> : null}
      {highlights.length === 0 ? <p role="status" className="px-5 py-4 text-sm text-muted-foreground">{query || activeKind || timing !== "all" ? "No matching entries in this period. Change the search or filters to see more." : "Nothing scheduled in this period."}</p> : null}

      {view === "month" ? <MonthView {...viewProps} anchor={anchor} onOpenDay={openDay} /> : null}
      {view === "week" ? <TimeGridView {...viewProps} dates={weekDateKeys(anchor)} byDate={byDate} onOpenDay={openDay} /> : null}
      {view === "day" ? <TimeGridView {...viewProps} dates={[anchor]} byDate={byDate} onOpenDay={openDay} /> : null}
      {view === "agenda" ? <AgendaView {...viewProps} anchor={anchor} byDate={byDate} /> : null}


      {detail ? <ItemPanel item={selected} kinds={kinds} detail={detail} onClose={() => setSelectedId(null)} /> : null}
    </section>
    </TooltipProvider>
  );
}

function ItemPanel<Item extends PortalCalendarItem>({ item, kinds, detail, onClose }: { item: Item | null; kinds: Record<string, PortalCalendarKind>; detail: PortalCalendarDetail<Item>; onClose: () => void }) {
  const kind = item ? kindOf(kinds, item.kind) : null;
  return (
    <Sheet open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {item && kind ? (
        <SheetContent className="gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border pr-12">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden className={cn("size-2 rounded-full", kind.dot)} />{kind.label}</p>
            <SheetTitle className="break-words text-lg">{item.title}</SheetTitle>
            <SheetDescription>{formatPortalDate(item.date)} · {timeRange(item)}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 p-4 text-sm">
            {item.detail ? <p className="break-words text-foreground">{item.detail}</p> : null}
            {detail.body?.(item)}
          </div>
          {detail.action ? <SheetFooter>{detail.action(item)}</SheetFooter> : null}
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function ViewSwitcher({ view, onChange }: { view: CalendarViewId; onChange: (view: CalendarViewId) => void }) {
  const current = CALENDAR_VIEWS.find((entry) => entry.id === view) ?? CALENDAR_VIEWS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Calendar view: ${current.label}`}>{current.label}<ChevronDown className="size-4 text-muted-foreground" aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {CALENDAR_VIEWS.map((entry) => (
          <DropdownMenuItem key={entry.id} onSelect={() => onChange(entry.id)}>
            {entry.label}
            {entry.id === view ? <Check className="ml-1 size-3.5" aria-hidden /> : null}
            <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MonthView<Item extends PortalCalendarItem>({ items, kinds, today, renderItem, anchor, onOpenDay }: ViewProps<Item> & { anchor: string; onOpenDay: (dateKey: string) => void }) {
  const month = monthOfDateKey(anchor);
  const weeks = monthWeeks(month);
  const byDate = useMemo(() => itemsByDate(items), [items]);
  const inMonth = (dateKey: string) => dateKey.startsWith(`${month.year}-${String(month.month + 1).padStart(2, "0")}-`);
  const monthItems = weeks.flat().filter(inMonth).flatMap((dateKey) => byDate.get(dateKey) ?? []);
  const [moreDate, setMoreDate] = useState<string | null>(null);
  const chip = (item: Item, outside: boolean) => (
    <Fragment key={item.id}>
      {renderItem({
        item,
        variant: "chip",
        title: tooltip(item),
        className: cn(chipBase, kindOf(kinds, item.kind).chip, outside && "opacity-60"),
        children: <>{item.startTime ? <span className="mr-1 font-normal opacity-70">{clockLabel(item.startTime)}</span> : null}{item.chipLabel ?? item.title}</>,
      })}
    </Fragment>
  );

  return (
    <>
      {/* Phone: the month as a dated list. */}
      <div className="sm:hidden">
        <AgendaList dates={weeks.flat().filter(inMonth)} byDate={byDate} kinds={kinds} renderItem={renderItem} today={today} items={monthItems} emptyText="Nothing scheduled this month." />
      </div>

      {/* Tablet and desktop: the month grid. */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 border-b border-border text-center text-xs text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((day) => <span key={day} className="px-2 py-2">{day}</span>)}
        </div>
        <div role="grid" aria-label={periodTitle("month", anchor)}>
          {weeks.map((week) => (
            <div key={week[0]} role="row" className="grid grid-cols-7">
              {week.map((dateKey, index) => {
                const dayItems = byDate.get(dateKey) ?? [];
                const outside = !inMonth(dateKey);
                return (
                  <div
                    key={dateKey}
                    role="gridcell"
                    data-date={dateKey}
                    aria-label={`${formatPortalDate(dateKey)}${dayItems.length ? `, ${dayItems.length} scheduled` : ""}`}
                    className={cn("flex min-h-28 min-w-0 flex-col gap-1 border-b border-border p-1.5", index > 0 && "border-l", outside && "bg-muted/30")}
                  >
                    <button type="button" onClick={() => onOpenDay(dateKey)} aria-label={`Open ${formatPortalDate(dateKey)}`} className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium hover:bg-muted", dateKey === today ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : outside ? "text-muted-foreground/60" : "text-foreground")}>{Number(dateKey.slice(8))}</button>
                    {dayItems.slice(0, MAX_MONTH_CHIPS).map((item) => chip(item, outside))}
                    {dayItems.length > MAX_MONTH_CHIPS ? (
                      <Popover open={moreDate === dateKey} onOpenChange={(open) => setMoreDate(open ? dateKey : null)}>
                        <PopoverTrigger asChild>
                          <button type="button" className="px-1 text-left text-xs text-muted-foreground hover:text-foreground">+{dayItems.length - MAX_MONTH_CHIPS} more</button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2" onClick={() => setMoreDate(null)}>
                          <p className="px-1 pb-1 text-xs font-medium text-foreground">{formatPortalDate(dateKey)}</p>
                          {dayItems.map((item) => chip(item, false))}
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TimeGridView<Item extends PortalCalendarItem>({ items, kinds, today, renderItem, dates, byDate, onOpenDay }: ViewProps<Item> & { dates: string[]; byDate: Map<string, Item[]>; onOpenDay: (dateKey: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const multi = dates.length > 1;
  const hasAllDay = dates.some((dateKey) => (byDate.get(dateKey) ?? []).some((item) => !item.startTime));
  const firstTimed = items.filter((item) => item.startTime && dates.includes(item.date)).map((item) => minutesOf(item.startTime as string));

  useEffect(() => {
    const read = () => setNowMinutes(minutesOf(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date())));
    read();
    const timer = window.setInterval(read, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const target = firstTimed.length ? Math.min(...firstTimed) : 7 * 60;
    scrollRef.current?.scrollTo({ top: Math.max(0, (target / 60 - 1) * HOUR_PX) });
  }, [dates.join(","), firstTimed.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className="sm:hidden"><AgendaList dates={dates} byDate={byDate} kinds={kinds} renderItem={renderItem} today={today} items={dates.flatMap((date) => byDate.get(date) ?? [])} emptyText="Nothing scheduled in this period." /></div>
    <div className="hidden overflow-x-auto sm:block">
      <div className={cn(multi && "min-w-[44rem]")}>
        <div className="grid border-b border-border text-center text-xs" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
          <span aria-hidden className="py-2 text-muted-foreground">GMT+8</span>
          {dates.map((dateKey) => (
            <button key={dateKey} type="button" onClick={() => onOpenDay(dateKey)} aria-label={`Open ${formatPortalDate(dateKey)}`} className={cn("py-2 hover:bg-muted/50", dateKey === today ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()]} {dateKey.slice(8)}
            </button>
          ))}
        </div>

        {hasAllDay ? (
          <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
            <span className="px-1 py-1.5 text-right text-xs text-muted-foreground">All day</span>
            {dates.map((dateKey) => (
              <div key={dateKey} className="flex min-w-0 flex-col gap-1 border-l border-border p-1">
                {(byDate.get(dateKey) ?? []).filter((item) => !item.startTime).map((item) => (
                  <Fragment key={item.id}>{renderItem({ item, variant: "chip", title: tooltip(item), className: cn(chipBase, kindOf(kinds, item.kind).chip), children: item.title })}</Fragment>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div ref={scrollRef} className="max-h-[40rem] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))`, height: HOUR_PX * 24 }}>
            <div aria-hidden className="relative">
              {HOURS.slice(1).map((hour) => <span key={hour} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground" style={{ top: hour * HOUR_PX }}>{hour % 12 === 0 ? 12 : hour % 12} {hour >= 12 ? "PM" : "AM"}</span>)}
            </div>
            {dates.map((dateKey) => (
              <DayColumn key={dateKey} dateKey={dateKey} items={(byDate.get(dateKey) ?? []).filter((item) => item.startTime)} kinds={kinds} renderItem={renderItem} nowMinutes={dateKey === today ? nowMinutes : null} />
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function DayColumn<Item extends PortalCalendarItem>({ dateKey, items, kinds, renderItem, nowMinutes }: { dateKey: string; items: Item[]; kinds: Record<string, PortalCalendarKind>; renderItem: PortalCalendarItemRenderer<Item>; nowMinutes: number | null }) {
  const placements = layoutOverlaps(items.flatMap((item) => { const span = spanOf(item); return span ? [{ ...span, id: item.id }] : []; }));
  return (
    <div role="gridcell" data-date={dateKey} aria-label={formatPortalDate(dateKey)} className="relative border-l border-border">
      {HOURS.slice(1).map((hour) => <span key={hour} aria-hidden className="absolute inset-x-0 border-t border-border/70" style={{ top: hour * HOUR_PX }} />)}
      {items.map((item) => {
        const span = spanOf(item);
        const place = placements.get(item.id);
        if (!span || !place) return null;
        const style: CSSProperties = {
          top: (span.start / 60) * HOUR_PX,
          height: Math.max(((span.end - span.start) / 60) * HOUR_PX - 2, 22),
          left: `calc(${(place.column / place.columns) * 100}% + 2px)`,
          width: `calc(${100 / place.columns}% - 4px)`,
        };
        return (
          <Fragment key={item.id}>
            {renderItem({
              item,
              variant: "block",
              title: tooltip(item),
              style,
              className: cn("absolute overflow-hidden rounded-md border border-white/60 px-2 py-2 text-left text-xs", kindOf(kinds, item.kind).chip),
              children: <><span className="line-clamp-2 font-medium">{item.title}</span><span className="mt-1 block truncate opacity-70">{timeRange(item)}</span>{item.detail ? <span className="mt-2 block truncate opacity-70">{item.detail}</span> : null}</>,
            })}
          </Fragment>
        );
      })}
      {nowMinutes !== null ? (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMinutes / 60) * HOUR_PX }}>
          <span className="-ml-1 size-2 rounded-full bg-foreground" />
          <span className="h-px flex-1 bg-foreground" />
        </span>
      ) : null}
    </div>
  );
}

function AgendaView<Item extends PortalCalendarItem>({ items, kinds, today, renderItem, anchor, byDate }: ViewProps<Item> & { anchor: string; byDate: Map<string, Item[]> }) {
  const dates = Array.from({ length: AGENDA_DAYS }, (_, index) => addDays(anchor, index));
  const shown = dates.flatMap((dateKey) => byDate.get(dateKey) ?? []);
  return <AgendaList dates={dates} byDate={byDate} kinds={kinds} renderItem={renderItem} today={today} items={shown} emptyText={`Nothing scheduled between ${formatPortalDate(dates[0])} and ${formatPortalDate(dates[dates.length - 1])}.`} />;
}

function AgendaList<Item extends PortalCalendarItem>({ dates, byDate, kinds, renderItem, today, items, emptyText }: { dates: string[]; byDate: Map<string, Item[]>; kinds: Record<string, PortalCalendarKind>; renderItem: PortalCalendarItemRenderer<Item>; today: string; items: Item[]; emptyText: string }) {
  if (items.length === 0) return <p className="px-4 py-8 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-5 px-3 py-4 sm:px-4">
      {dates.filter((dateKey) => byDate.has(dateKey)).map((dateKey) => (
        <section key={dateKey} aria-label={formatPortalDate(dateKey)}>
          <h3 className="mb-2 flex items-center gap-3 text-xs font-medium text-muted-foreground"><span className={cn(dateKey === today && "text-foreground")}>{new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T00:00:00Z`))}{dateKey === today ? " · Today" : ""}</span><span aria-hidden className="h-px flex-1 bg-border" /></h3>
          <ul className="space-y-2">
            {(byDate.get(dateKey) ?? []).map((item) => (
              <li key={item.id}>
                {renderItem({
                  item,
                  variant: "card",
                  title: tooltip(item),
                  className: cn("block w-full min-w-0 rounded-md px-3 py-2.5 text-left", kindOf(kinds, item.kind).chip),
                  children: <><span className="block break-words text-sm font-medium">{item.title}</span><span className="mt-0.5 block break-words text-xs opacity-80">{[timeRange(item), item.detail].filter(Boolean).join(" · ")}</span></>,
                })}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
