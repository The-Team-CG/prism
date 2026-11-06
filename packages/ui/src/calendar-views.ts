import { monthLabel, monthOfDateKey, shiftMonth, toDateKey, type CalendarMonth } from "./calendar-grid";

export type CalendarViewId = "month" | "week" | "day" | "agenda";

export const CALENDAR_VIEWS: ReadonlyArray<{ id: CalendarViewId; label: string; shortcut: string }> = [
  { id: "month", label: "Month", shortcut: "M" },
  { id: "week", label: "Week", shortcut: "W" },
  { id: "day", label: "Day", shortcut: "D" },
  { id: "agenda", label: "Agenda", shortcut: "A" },
];

/** The agenda lists this many days from the anchor date. */
export const AGENDA_DAYS = 30;
export const DEFAULT_ITEM_MINUTES = 60;

const DAY_MS = 86_400_000;
const utcOf = (dateKey: string) => Date.parse(`${dateKey}T00:00:00Z`);
const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(dateKey: string, days: number): string {
  return keyOf(utcOf(dateKey) + days * DAY_MS);
}

/** Sunday-first week containing the date. */
export function weekDateKeys(dateKey: string): string[] {
  const sunday = addDays(dateKey, -new Date(utcOf(dateKey)).getUTCDay());
  return Array.from({ length: 7 }, (_, index) => addDays(sunday, index));
}

/** Whole weeks covering the month, including the neighbouring days that fill the first and last row. */
export function monthWeeks(calendarMonth: CalendarMonth): string[][] {
  const first = toDateKey(calendarMonth.year, calendarMonth.month, 1);
  const last = toDateKey(calendarMonth.year, calendarMonth.month, new Date(Date.UTC(calendarMonth.year, calendarMonth.month + 1, 0)).getUTCDate());
  const weeks: string[][] = [];
  for (let cursor = weekDateKeys(first)[0]; cursor <= weekDateKeys(last)[6]; cursor = addDays(cursor, 7)) weeks.push(weekDateKeys(cursor));
  return weeks;
}

export function shiftAnchor(view: CalendarViewId, anchor: string, direction: 1 | -1): string {
  if (view === "month") {
    const next = shiftMonth(monthOfDateKey(anchor), direction);
    return toDateKey(next.year, next.month, 1);
  }
  if (view === "week") return addDays(anchor, 7 * direction);
  if (view === "day") return addDays(anchor, direction);
  return addDays(anchor, AGENDA_DAYS * direction);
}

const shortMonth = (dateKey: string) => new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(new Date(utcOf(dateKey)));

/** The heading for the visible period: a month, a week's month(s), one day, or the agenda's range. */
export function periodTitle(view: CalendarViewId, anchor: string): string {
  if (view === "month") return monthLabel(monthOfDateKey(anchor));
  if (view === "day") return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(utcOf(anchor)));
  const start = view === "week" ? weekDateKeys(anchor)[0] : anchor;
  const end = view === "week" ? weekDateKeys(anchor)[6] : addDays(anchor, AGENDA_DAYS - 1);
  const year = end.slice(0, 4);
  if (start.slice(0, 7) === end.slice(0, 7)) return monthLabel(monthOfDateKey(start));
  return `${shortMonth(start)} – ${shortMonth(end)} ${year}`;
}

export type VisibleRange = { from: string; to: string };

/** The first and last date the view puts on screen, including the neighbouring days a month grid shows. */
export function visibleRange(view: CalendarViewId, anchor: string): VisibleRange {
  if (view === "month") {
    const weeks = monthWeeks(monthOfDateKey(anchor));
    return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
  }
  if (view === "week") {
    const week = weekDateKeys(anchor);
    return { from: week[0], to: week[6] };
  }
  if (view === "day") return { from: anchor, to: anchor };
  return { from: anchor, to: addDays(anchor, AGENDA_DAYS - 1) };
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** "9:30" style times as the calendar writes them: 10am, 2:30pm. */
export function clockLabel(time: string): string {
  const total = minutesOf(time);
  const hours24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes ? `${hours12}:${String(minutes).padStart(2, "0")}${suffix}` : `${hours12}${suffix}`;
}

export type TimedSpan = { id: string; start: number; end: number };
export type SpanPlacement = { column: number; columns: number };

/**
 * Places overlapping time spans side by side. Spans that overlap (directly or through a chain) share
 * the columns of their group, so each block gets an equal slice of the day column's width.
 */
export function layoutOverlaps(spans: TimedSpan[]): Map<string, SpanPlacement> {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const placements = new Map<string, SpanPlacement>();
  let group: Array<{ id: string; column: number }> = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;

  const flush = () => {
    for (const member of group) placements.set(member.id, { column: member.column, columns: columnEnds.length });
    group = [];
    columnEnds = [];
  };

  for (const span of sorted) {
    if (group.length && span.start >= groupEnd) flush();
    let column = columnEnds.findIndex((end) => end <= span.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = span.end;
    group.push({ id: span.id, column });
    groupEnd = Math.max(groupEnd, span.end);
  }
  flush();
  return placements;
}

export function spanOf(item: { startTime?: string; endTime?: string }): TimedSpan | null {
  if (!item.startTime) return null;
  const start = minutesOf(item.startTime);
  const end = item.endTime ? Math.max(minutesOf(item.endTime), start + 15) : start + DEFAULT_ITEM_MINUTES;
  return { id: "", start, end: Math.min(end, 24 * 60) };
}
