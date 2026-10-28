/** A calendar month addressed by year and 0-based month index (0 = January). */
export type CalendarMonth = { year: number; month: number };

export type CalendarGridCell =
  | { kind: "blank"; key: string }
  | { kind: "day"; key: string; dateKey: string; day: number; isToday: boolean; eventIds: string[] };

const pad = (value: number) => String(value).padStart(2, "0");

export function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Today's calendar date in Philippine time, the portal's operating timezone. */
export function todayDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Event dates arrive as calendar dates (YYYY-MM-DD) or ISO timestamps. Calendar dates keep their day;
 * timestamps resolve to the Philippine calendar date. Returns null for unusable values.
 */
export function eventDateKey(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return todayDateKey(date);
}

export function monthOfDateKey(dateKey: string): CalendarMonth {
  const [year, month] = dateKey.split("-").map(Number);
  return { year, month: month - 1 };
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function daysInMonth({ year, month }: CalendarMonth) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function monthLabel({ year, month }: CalendarMonth) {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
}

export function isDateKeyInMonth(dateKey: string, { year, month }: CalendarMonth) {
  return dateKey.startsWith(`${year}-${pad(month + 1)}-`);
}

/**
 * Builds a Sunday-first month grid: leading blanks for the weekday offset of day 1,
 * one cell per real date, and trailing blanks to complete the final week.
 * Events are matched by full YYYY-MM-DD, so other months never mark this one.
 */
export function buildCalendarMonthGrid(
  calendarMonth: CalendarMonth,
  events: ReadonlyArray<{ id: string; eventDate: string }>,
  today: string = todayDateKey(),
): CalendarGridCell[] {
  const { year, month } = calendarMonth;
  const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const total = daysInMonth(calendarMonth);
  const eventsByDate = new Map<string, string[]>();
  for (const event of events) {
    const key = eventDateKey(event.eventDate);
    if (!key) continue;
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event.id]);
  }

  const cells: CalendarGridCell[] = Array.from({ length: offset }, (_, index) => ({ kind: "blank", key: `lead-${index}` }));
  for (let day = 1; day <= total; day += 1) {
    const dateKey = toDateKey(year, month, day);
    cells.push({ kind: "day", key: dateKey, dateKey, day, isToday: dateKey === today, eventIds: eventsByDate.get(dateKey) ?? [] });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let index = 0; index < trailing; index += 1) cells.push({ kind: "blank", key: `trail-${index}` });
  return cells;
}
