"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Info } from "lucide-react";
import { CalendarFilters, CalendarToolbar, type CalendarDayLayout, type CalendarTiming } from "./calendar-toolbar";
import { monthOfDateKey } from "./calendar-grid";
import { CalendarHighlights, lateLabel, lookOf, pickCalendarHighlights, relatedCalendarItems } from "./calendar-highlights";
import { CountdownPill } from "./event-cards/event-card";
import { useCalendarPlace, type CalendarPlace } from "./calendar-place";
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
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./components/ui/sheet";
import { formatPortalDate } from "./format-date";
import { cn } from "./utils";

const HOUR_PX = 64;
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
  /**
   * The event this entry belongs to, named the same way on every portal: after what is due on a month chip, under it
   * everywhere else. Left out on the event's own day, whose title already names it.
   */
  eventName?: string;
  /** Past its date and still open, such as a late payment: listed first in the highlights wherever its date falls. */
  overdue?: boolean;
  /** The event the entry belongs to, so its details panel can list the event's other entries. */
  eventId?: string;
  /** Finished, such as a paid payment or an approved layout: hidden by the "Hide paid and done" filter. */
  done?: boolean;
  kind: string;
  /** Philippine wall-clock time, HH:mm. Items without one are all-day. */
  startTime?: string;
  endTime?: string;
  /** Overrides the kind's colours and name for this item, such as a payment coloured by whether it is paid, late or due. */
  look?: PortalCalendarLook;
};
export type PortalCalendarKind = { label: string; chip: string; dot: string };
export { lookOf, pickCalendarHighlights, relatedCalendarItems };
export { calendarPlaceSearch, readCalendarPlace, type CalendarPlace } from "./calendar-place";
export type PortalCalendarLook = Partial<PortalCalendarKind> & { chip: string };

export type PaymentCalendarState = "paid" | "late" | "due";

/** One colour per payment state on every portal's calendar, with the word that says it so colour is never alone. */
export const PAYMENT_CALENDAR_LOOK: Record<PaymentCalendarState, PortalCalendarKind & { word: string }> = {
  paid: { label: "Paid", chip: "bg-success-soft text-success hover:bg-success/15", dot: "bg-success", word: "paid" },
  late: { label: "Payment late", chip: "bg-danger-soft text-danger hover:bg-danger/15", dot: "bg-danger", word: "late" },
  due: { label: "Payment due", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention", word: "due" },
};

/** The red "late" look for any overdue entry, named for what it is: "Task late". Same colours as a late payment. */
export function lateCalendarLook(label: string): PortalCalendarLook {
  const { chip, dot } = PAYMENT_CALENDAR_LOOK.late;
  return { chip, dot, label };
}

/** Paid when nothing is left; late when its date has passed; otherwise due. Dates are YYYY-MM-DD. */
export function paymentCalendarState(dueDate: string, today: string, paid: boolean): PaymentCalendarState {
  if (paid) return "paid";
  return dueDate < today ? "late" : "due";
}

/** Portals own navigation: each renders the link or button for an item with the class and style it is given. */
export type PortalCalendarItemRenderer<Item extends PortalCalendarItem> = (input: {
  item: Item;
  variant: "chip" | "block" | "card";
  className: string;
  style?: CSSProperties;
  title: string;
  children: ReactNode;
}) => ReactNode;

/** A strip on a highlight card, or the banner across the top of the details panel. */
export type PortalCalendarCoverSize = "strip" | "banner";

/** One labelled fact in an item's details panel: "Amount", "₱84,000". */
export type PortalCalendarFact = { label: string; value: ReactNode };

/** Opt-in details panel: clicking an item opens it in a side panel instead of navigating straight away. */
export type PortalCalendarDetail<Item extends PortalCalendarItem> = {
  /** Facts listed under the item's event in the same layout on every portal: amount, status, place, client. With facts, the item's `detail` line is left to the agenda. */
  facts?: (item: Item) => PortalCalendarFact[];
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
  /** The category the calendar opens filtered to, such as a deep link to payment dates. */
  initialKind?: string;
  /** Opens with paid and done entries hidden, such as a link to what is still due. */
  initialOpenOnly?: boolean;
  /** Keeps the category, view, date and done filter in the address, so links and refreshes open the same place. */
  syncUrl?: boolean;
  /** The kind that marks an event's own day, so the next one always has a place in the highlights. */
  eventKind?: string;
  /**
   * The picture of an item's event (the shared event cover), shown on the next event's highlight and at the top of the
   * details panel. Null when the portal does not know the event.
   */
  cover?: (item: Item, size: PortalCalendarCoverSize) => ReactNode;
  className?: string;
  /** Called with the dates on screen when the calendar opens and whenever the view or period changes. */
  onRangeChange?: (range: VisibleRange) => void;
};

type ViewProps<Item extends PortalCalendarItem> = {
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  today: string;
  renderItem: PortalCalendarItemRenderer<Item>;
};

const chipBase = "block w-full min-w-0 break-words rounded-md border-l-2 border-current/20 px-2 py-1.5 text-left text-xs font-medium leading-relaxed transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const weekendTexture: CSSProperties = { backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 4px, color-mix(in srgb, var(--border) 28%, transparent) 4px, color-mix(in srgb, var(--border) 28%, transparent) 5px)" };
const isWeekend = (dateKey: string) => [0, 6].includes(new Date(`${dateKey}T00:00:00Z`).getUTCDay());
const kindOf = (kinds: Record<string, PortalCalendarKind>, kind: string) => kinds[kind] ?? { label: kind, chip: "bg-muted text-foreground", dot: "bg-muted-foreground" };
const chipOf = (kinds: Record<string, PortalCalendarKind>, item: PortalCalendarItem) => lookOf(kinds, item).chip;
/** What an entry says in one line: what is due, then whose event, so a calendar across events is never ambiguous. */
const chipText = (item: PortalCalendarItem) => [item.chipLabel ?? item.title, item.eventName].filter(Boolean).join(" · ");
/**
 * A chip's words. With an event, "what" fills the first line and the event a second, lighter one, each cut on its own,
 * so a long event name never pushes the "what" out of view. The event's own day may wrap to two lines.
 */
function ChipText({ item }: { item: PortalCalendarItem }) {
  const time = item.startTime ? <span className="mr-1 font-normal opacity-70">{clockLabel(item.startTime)}</span> : null;
  if (!item.eventName) return <span className="line-clamp-2">{time}{item.chipLabel ?? item.title}</span>;
  return (
    <>
      <span className="block truncate">{time}{item.chipLabel ?? item.title}</span>
      <span className="block truncate font-normal opacity-75">{item.eventName}</span>
    </>
  );
}
/** An entry's time; empty for all-day entries, which most are, so only real times are written out. */
const timeRange = (item: PortalCalendarItem) => (item.startTime ? [clockLabel(item.startTime), item.endTime ? clockLabel(item.endTime) : null].filter(Boolean).join(" – ") : "");
// A look's own name ("Payment late") leads, so an entry's state is said in words and never by colour alone.
const tooltip = (item: PortalCalendarItem) => [item.title, item.look?.label, item.eventName, timeRange(item), item.detail].filter(Boolean).join(" · ");
const secondLine = (item: PortalCalendarItem) => [item.look?.label, timeRange(item), item.eventName, item.detail].filter(Boolean).join(" · ");

function itemsByDate<Item extends PortalCalendarItem>(items: Item[]) {
  const byDate = new Map<string, Item[]>();
  for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  for (const list of byDate.values()) list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return byDate;
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Search, category, timing and the done filter, and the items each leaves on the calendar. */
function useCalendarFilters<Item extends PortalCalendarItem>(items: Item[], kinds: Record<string, PortalCalendarKind>, opening: CalendarPlace) {
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<string | null>(opening.kind);
  const [timing, setTiming] = useState<CalendarTiming>("all");
  const [openOnly, setOpenOnly] = useState(opening.openOnly);
  const matchingItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const fitsTiming = (item: Item) => timing === "all" || (timing === "timed") === Boolean(item.startTime);
    return items.filter((item) => searchText(kinds, item).includes(needle) && !(openOnly && item.done) && fitsTiming(item));
  }, [items, kinds, query, timing, openOnly]);
  const filteredItems = useMemo(() => matchingItems.filter((item) => activeKind === null || item.kind === activeKind), [matchingItems, activeKind]);
  const categoryLabel = activeKind ? kinds[activeKind].label : null;
  return {
    query, setQuery, activeKind, setActiveKind, timing, setTiming, openOnly, setOpenOnly,
    matchingItems, filteredItems, categoryLabel,
    canFilterDone: openOnly || items.some((item) => item.done),
    filterCount: [categoryLabel !== null, timing !== "all", openOnly].filter(Boolean).length,
  };
}

const searchText = (kinds: Record<string, PortalCalendarKind>, item: PortalCalendarItem) =>
  [item.title, item.detail, item.chipLabel, item.eventName, kindOf(kinds, item.kind).label].filter(Boolean).join(" ").toLocaleLowerCase();

/** M, W, D and A switch views while no panel is open and the reader is not typing. */
function useViewShortcuts(paused: boolean, onView: (view: CalendarViewId) => void) {
  useEffect(() => {
    if (paused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const match = CALENDAR_VIEWS.find((entry) => entry.shortcut.toLowerCase() === event.key.toLowerCase());
      if (match) onView(match.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps
}

const periodContextOf = (view: CalendarViewId) => (view === "day" ? "on this day" : "in this period");
const emptyPeriodText = (view: CalendarViewId, narrowed: boolean) =>
  narrowed ? `No matching entries ${periodContextOf(view)}. Change the search or filters to see more.` : `Nothing scheduled ${periodContextOf(view)}.`;

function CalendarFooter({ count, view }: { count: number; view: CalendarViewId }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
      <span>{count} {count === 1 ? "entry" : "entries"} {periodContextOf(view)}</span>
      <Popover>
        <PopoverTrigger asChild><button type="button" className="inline-flex min-h-8 items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manila time<Info aria-hidden className="size-3.5" /></button></PopoverTrigger>
        <PopoverContent align="end" collisionPadding={16} className="w-72 text-sm">All times are Philippine Standard Time.<span className="mt-1 block text-xs text-muted-foreground">Asia/Manila · UTC+08:00</span></PopoverContent>
      </Popover>
    </footer>
  );
}

/** A calendar with month, week, day and agenda views. Role-neutral: portals decide which items exist and where each leads. */
export function PortalCalendar<Item extends PortalCalendarItem>({ items, kinds, today, initialDate, initialView = "month", initialKind, initialOpenOnly = false, syncUrl = false, eventKind = "event", cover, className, onRangeChange, renderItem, detail }: PortalCalendarProps<Item>) {
  const headingId = useId();
  const opening: CalendarPlace = { kind: initialKind && initialKind in kinds ? initialKind : null, view: initialView, date: initialDate, openOnly: initialOpenOnly };
  const [view, setView] = useState<CalendarViewId>(opening.view);
  const [dayLayout, setDayLayout] = useState<CalendarDayLayout>("agenda");
  const [anchor, setAnchor] = useState(opening.date);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filters = useCalendarFilters(items, kinds, opening);
  const changeView = (next: CalendarViewId) => { setView(next); if (next === "day") setDayLayout("agenda"); };
  useCalendarPlace({
    enabled: syncUrl,
    defaults: opening,
    kinds,
    place: { kind: filters.activeKind, view, date: anchor, openOnly: filters.openOnly },
    apply: (place) => { filters.setActiveKind(place.kind); setView(place.view); setAnchor(place.date); filters.setOpenOnly(place.openOnly); },
  });
  useViewShortcuts(selectedId !== null, changeView);
  const byDate = useMemo(() => itemsByDate(filters.filteredItems), [filters.filteredItems]);
  const selected = detail ? items.find((item) => item.id === selectedId) ?? null : null;

  const selectChip: PortalCalendarItemRenderer<Item> = ({ item, className: chipClass, style, title, children }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" style={style} className={chipClass} aria-label={title} aria-haspopup="dialog" onClick={() => setSelectedId(item.id)}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );

  const range = visibleRange(view, anchor);
  useEffect(() => {
    onRangeChange?.({ from: range.from, to: range.to });
  }, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDay = (dateKey: string) => { setAnchor(dateKey); changeView("day"); };
  const renderCalendarItem = renderItem ?? selectChip;
  const periodStart = view === "month" ? `${anchor.slice(0, 7)}-01` : range.from;
  const inPeriod = (item: Item) => (view === "month" ? item.date.startsWith(anchor.slice(0, 7)) : item.date >= range.from && item.date <= range.to);
  const shownCount = filters.filteredItems.filter(inPeriod).length;

  return (
    <TooltipProvider delayDuration={300}>
    <section aria-labelledby={headingId} className={cn("min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card [&_[data-slot=button]]:shadow-none", className)}>
      <CalendarToolbar headingId={headingId} rangeLabel={periodTitle(view, anchor)} anchor={anchor} view={view} dayLayout={dayLayout}
        onDateChange={setAnchor} onMove={(direction) => setAnchor((current) => shiftAnchor(view, current, direction))} onToday={() => setAnchor(today)}
        onViewChange={changeView} onDayLayoutChange={setDayLayout}>
        <CalendarFilters query={filters.query} onQueryChange={filters.setQuery} activeKind={filters.activeKind} onKindChange={filters.setActiveKind}
          openOnly={filters.openOnly} onOpenOnlyChange={filters.canFilterDone ? filters.setOpenOnly : undefined}
          timing={filters.timing} onTimingChange={filters.setTiming} kinds={kinds} periodItems={filters.matchingItems.filter(inPeriod)}
          categoryLabel={filters.categoryLabel} filterCount={filters.filterCount} />
      </CalendarToolbar>
      <CalendarHighlights items={filters.filteredItems} kinds={kinds} today={today} eventKind={eventKind} cover={cover} renderItem={renderCalendarItem} />
      {shownCount === 0 ? <EmptyPeriod text={emptyPeriodText(view, Boolean(filters.query || filters.filterCount))} items={filters.filteredItems} inPeriod={inPeriod} periodStart={periodStart} onJump={setAnchor} /> : null}
      <CalendarContent items={filters.filteredItems} kinds={kinds} today={today} renderItem={renderCalendarItem} view={view} dayLayout={dayLayout} anchor={anchor} byDate={byDate} onOpenDay={openDay} />
      <CalendarFooter count={shownCount} view={view} />
      {detail ? <ItemPanel item={selected} related={selected ? relatedCalendarItems(items, selected, today) : []} kinds={kinds} today={today} eventKind={eventKind} cover={cover} detail={detail} onSelect={setSelectedId} onClose={() => setSelectedId(null)} /> : null}
    </section>
    </TooltipProvider>
  );
}

function CalendarContent<Item extends PortalCalendarItem>({ view, dayLayout, anchor, byDate, onOpenDay, ...props }: ViewProps<Item> & {
  view: CalendarViewId;
  dayLayout: CalendarDayLayout;
  anchor: string;
  byDate: Map<string, Item[]>;
  onOpenDay: (date: string) => void;
}) {
  switch (view) {
    case "month": return <MonthView {...props} anchor={anchor} onOpenDay={onOpenDay} />;
    case "week": return <TimeGridView {...props} dates={weekDateKeys(anchor)} byDate={byDate} onOpenDay={onOpenDay} />;
    case "day": return dayLayout === "agenda"
      ? <div role="region" aria-label="Daily agenda" data-date={anchor}><AgendaList {...props} dates={[anchor]} byDate={byDate} items={byDate.get(anchor) ?? []} /></div>
      : <TimeGridView {...props} dates={[anchor]} byDate={byDate} onOpenDay={onOpenDay} />;
    case "agenda": return <AgendaView {...props} anchor={anchor} byDate={byDate} />;
  }
}

/**
 * Nothing on screen: say so, and offer the nearest entries before and after the period, so an empty month is a step
 * toward the work instead of a dead end.
 */
function EmptyPeriod<Item extends PortalCalendarItem>({ text, items, inPeriod, periodStart, onJump }: {
  text: string;
  items: Item[];
  inPeriod: (item: Item) => boolean;
  periodStart: string;
  onJump: (date: string) => void;
}) {
  const outside = items.filter((item) => !inPeriod(item)).sort((a, b) => a.date.localeCompare(b.date));
  const nearest = [
    { word: "Last", item: outside.filter((item) => item.date < periodStart).pop() },
    { word: "Next", item: outside.find((item) => item.date > periodStart) },
  ].filter((entry): entry is { word: string; item: Item } => entry.item !== undefined);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-sm text-muted-foreground">
      <p role="status">{text}</p>
      {nearest.map(({ word, item }) => (
        <button key={word} type="button" onClick={() => onJump(item.date)} className="min-h-8 rounded-sm text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {word}: {chipText(item)}, {formatPortalDate(item.date)}
        </button>
      ))}
    </div>
  );
}

function PanelFacts({ facts }: { facts: PortalCalendarFact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
      {facts.map((fact) => (
        <Fragment key={fact.label}>
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{fact.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** The event's other entries in the panel; choosing one shows it in the same panel. */
function RelatedEntries<Item extends PortalCalendarItem>({ heading, items, kinds, today, eventKind, onSelect }: {
  heading: string;
  items: Item[];
  kinds: Record<string, PortalCalendarKind>;
  today: string;
  eventKind: string;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={heading} className="space-y-1 border-t border-border pt-3">
      <h3 className="px-2 text-xs font-medium text-muted-foreground">{heading}</h3>
      <ul>
        {items.map((other) => {
          const look = lookOf(kinds, other);
          const late = lateLabel(other, today);
          return (
            <li key={other.id}>
              <button type="button" onClick={() => onSelect(other.id)} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", look.dot)} />
                <span className="min-w-0 flex-1 truncate">{other.kind === eventKind ? look.label : other.chipLabel ?? other.title}</span>
                <span className={cn("shrink-0 text-xs tabular-nums", late ? "font-medium text-danger" : "text-muted-foreground")}>{late ?? formatPortalDate(other.date)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type PanelProps<Item extends PortalCalendarItem> = {
  related: Item[];
  kinds: Record<string, PortalCalendarKind>;
  today: string;
  eventKind: string;
  cover?: (item: Item, size: PortalCalendarCoverSize) => ReactNode;
  detail: PortalCalendarDetail<Item>;
  onSelect: (id: string) => void;
};

/** What the entry is, its name, and when: its date and time with a countdown, or how many days late it is. */
function PanelHeader({ item, kinds, today }: { item: PortalCalendarItem; kinds: Record<string, PortalCalendarKind>; today: string }) {
  const kind = lookOf(kinds, item);
  const late = lateLabel(item, today);
  return (
    <SheetHeader className="border-b border-border pr-12">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden className={cn("size-2 rounded-full", kind.dot)} />{kind.label}</p>
      <SheetTitle className="break-words text-lg">{item.title}</SheetTitle>
      <SheetDescription className="flex flex-wrap items-center gap-2">
        {[formatPortalDate(item.date), timeRange(item)].filter(Boolean).join(" · ")}
        {late ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-danger">{late}</span> : <CountdownPill date={item.date} todayKey={today} />}
      </SheetDescription>
    </SheetHeader>
  );
}

/** The facts in one layout on every portal, the portal's own content, then the event's other entries. */
function PanelBody<Item extends PortalCalendarItem>({ item, related, kinds, today, eventKind, detail, onSelect }: Omit<PanelProps<Item>, "cover"> & { item: Item }) {
  const facts = [...(item.eventName ? [{ label: "Event", value: item.eventName }] : []), ...(detail.facts?.(item) ?? [])];
  return (
    <div className="space-y-3 p-4 text-sm">
      <PanelFacts facts={facts} />
      {item.detail && !detail.facts ? <p className="break-words text-foreground">{item.detail}</p> : null}
      {detail.body?.(item)}
      <RelatedEntries heading={item.kind === eventKind ? "Coming up for this event" : "Also for this event"} items={related} kinds={kinds} today={today} eventKind={eventKind} onSelect={onSelect} />
    </div>
  );
}

const CLOSE_ON_PICTURE = "[&>button:last-child]:rounded-full [&>button:last-child]:bg-card [&>button:last-child]:p-1 [&>button:last-child]:opacity-100 [&>button:last-child]:shadow-sm";

function PanelContent<Item extends PortalCalendarItem>({ item, cover, detail, ...rest }: PanelProps<Item> & { item: Item }) {
  const picture = cover?.(item, "banner");
  return (
    <SheetContent className={cn("gap-0 overflow-y-auto sm:max-w-md", picture && CLOSE_ON_PICTURE)}>
      {picture ? <div className="shrink-0">{picture}</div> : null}
      <PanelHeader item={item} kinds={rest.kinds} today={rest.today} />
      <PanelBody item={item} detail={detail} {...rest} />
      {detail.action ? <SheetFooter>{detail.action(item)}</SheetFooter> : null}
    </SheetContent>
  );
}

/** An item's details: its event's picture, what it is and when, the same facts layout on every portal, then the event's other entries. */
function ItemPanel<Item extends PortalCalendarItem>({ item, onClose, ...panel }: PanelProps<Item> & { item: Item | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {item ? <PanelContent item={item} {...panel} /> : null}
    </Sheet>
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
        className: cn(chipBase, chipOf(kinds, item), outside && "opacity-60"),
        children: <ChipText item={item} />,
      })}
    </Fragment>
  );

  return (
    <>
      {/* Phone: the month as a dated list. */}
      <div className="sm:hidden">
        <AgendaList dates={weeks.flat().filter(inMonth)} byDate={byDate} kinds={kinds} renderItem={renderItem} today={today} items={monthItems} />
      </div>

      {/* Tablet and desktop: the month grid. */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/35 text-center text-xs text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((day) => <span key={day} className="px-2 py-3">{day}</span>)}
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
                    style={isWeekend(dateKey) ? weekendTexture : undefined}
                    className={cn("flex min-h-32 min-w-0 flex-col gap-1.5 border-b border-border/50 p-2.5", index > 0 && "border-l", outside ? "bg-muted/20" : dateKey === today && "bg-primary/[0.025]")}
                  >
                    <button type="button" onClick={() => onOpenDay(dateKey)} aria-label={`Open ${formatPortalDate(dateKey)}`} aria-current={dateKey === today ? "date" : undefined} className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", dateKey === today ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : outside ? "text-muted-foreground/60" : "text-muted-foreground")}>{Number(dateKey.slice(8))}</button>
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
  const firstTimed = items.flatMap((item) => item.startTime && dates.includes(item.date) ? [minutesOf(item.startTime)] : []);

  useEffect(() => {
    const read = () => setNowMinutes(minutesOf(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date())));
    read();
    const timer = window.setInterval(read, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const target = firstTimed.length ? Math.min(...firstTimed) : 7 * 60;
    scrollRef.current?.scrollTo({ top: Math.max(0, (target / 60 - 1) * HOUR_PX - 12) });
  }, [dates.join(","), firstTimed.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    {multi ? <div className="sm:hidden"><AgendaList dates={dates} byDate={byDate} kinds={kinds} renderItem={renderItem} today={today} items={dates.flatMap((date) => byDate.get(date) ?? [])} /></div> : null}
    <div className={cn("overflow-x-auto", multi && "hidden sm:block")}>
      <div className={cn(multi && "min-w-[44rem]")}>
        <div className="grid border-b border-border/60 bg-muted/35 text-center text-xs" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
          <span aria-hidden />
          {dates.map((dateKey) => (
            <button key={dateKey} type="button" onClick={() => onOpenDay(dateKey)} aria-label={`Open ${formatPortalDate(dateKey)}`} aria-current={dateKey === today ? "date" : undefined} className="flex flex-col items-center gap-1 py-3 text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className={cn(dateKey === today && "text-primary")}>{WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()]}</span><span className={cn("grid size-8 place-items-center rounded-full text-lg font-medium", dateKey === today ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{Number(dateKey.slice(8))}</span>
            </button>
          ))}
        </div>

        {hasAllDay ? (
          <div className="grid border-b border-border/60" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
            <span className="px-1 py-1.5 text-right text-xs text-muted-foreground">All day</span>
            {dates.map((dateKey) => (
              <div key={dateKey} className={cn("flex min-w-0 flex-col gap-1.5 border-l border-border/50 p-1.5", dateKey === today && "bg-primary/[0.025]")}>
                {(byDate.get(dateKey) ?? []).filter((item) => !item.startTime).map((item) => (
                  <Fragment key={item.id}>{renderItem({ item, variant: "chip", title: tooltip(item), className: cn(chipBase, chipOf(kinds, item)), children: <ChipText item={item} /> })}</Fragment>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div ref={scrollRef} className="max-h-[32rem] overflow-y-auto">
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
    <div role="gridcell" data-date={dateKey} aria-label={formatPortalDate(dateKey)} style={isWeekend(dateKey) ? weekendTexture : undefined} className={cn("relative border-l border-border/50", nowMinutes !== null && "bg-primary/[0.025]")}>
      {HOURS.slice(1).map((hour) => <span key={hour} aria-hidden className="absolute inset-x-0 border-t border-border/50" style={{ top: hour * HOUR_PX }} />)}
      {items.map((item) => {
        const span = spanOf(item);
        const place = placements.get(item.id);
        if (!span || !place) return null;
        const style: CSSProperties = {
          top: (span.start / 60) * HOUR_PX,
          height: Math.max(((span.end - span.start) / 60) * HOUR_PX - 2, 22),
          left: `calc(${(place.column / place.columns) * 100}% + 4px)`,
          width: `calc(${100 / place.columns}% - 8px)`,
        };
        return (
          <Fragment key={item.id}>
            {renderItem({
              item,
              variant: "block",
              title: tooltip(item),
              style,
              className: cn("absolute flex flex-col items-start overflow-hidden rounded-md border border-current/5 border-l-2 border-l-current/25 bg-linear-to-b from-card/15 to-transparent px-2 text-left text-xs shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", blockPadding(span.end - span.start), chipOf(kinds, item)),
              children: <BlockText item={item} minutes={span.end - span.start} />,
            })}
          </Fragment>
        );
      })}
      {nowMinutes !== null ? (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMinutes / 60) * HOUR_PX }}>
          <span className="-ml-1 size-2 rounded-full bg-primary" />
          <span className="h-px flex-1 bg-primary" />
        </span>
      ) : null}
    </div>
  );
}

const blockPadding = (minutes: number) => (minutes < 45 ? "py-0.5" : minutes < 60 ? "py-1" : "py-2");

/** A timed block's words, sized to the block: a title line, then time and event once there is room, the detail on long blocks. */
function BlockText({ item, minutes }: { item: PortalCalendarItem; minutes: number }) {
  return (
    <>
      <span className={cn("w-full font-medium leading-snug", minutes < 90 ? "truncate" : "line-clamp-2")}>{item.title}</span>
      {minutes >= 45 ? <span className="mt-0.5 block w-full truncate opacity-80">{[timeRange(item), item.eventName].filter(Boolean).join(" · ")}</span> : null}
      {item.detail && minutes >= 120 ? <span className="mt-auto block w-full truncate pt-1 opacity-80">{item.detail}</span> : null}
    </>
  );
}

function AgendaView<Item extends PortalCalendarItem>({ items, kinds, today, renderItem, anchor, byDate }: ViewProps<Item> & { anchor: string; byDate: Map<string, Item[]> }) {
  const dates = Array.from({ length: AGENDA_DAYS }, (_, index) => addDays(anchor, index));
  const shown = dates.flatMap((dateKey) => byDate.get(dateKey) ?? []);
  return <AgendaList dates={dates} byDate={byDate} kinds={kinds} renderItem={renderItem} today={today} items={shown} />;
}

function AgendaList<Item extends PortalCalendarItem>({ dates, byDate, kinds, renderItem, today, items }: { dates: string[]; byDate: Map<string, Item[]>; kinds: Record<string, PortalCalendarKind>; renderItem: PortalCalendarItemRenderer<Item>; today: string; items: Item[] }) {
  if (items.length === 0) return null;
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
                  className: cn("block w-full min-w-0 rounded-md px-3 py-2.5 text-left", chipOf(kinds, item)),
                  children: <><span className="block break-words text-sm font-medium">{item.title}</span>{secondLine(item) ? <span className="mt-0.5 block break-words text-xs opacity-80">{secondLine(item)}</span> : null}</>,
                })}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
