/** PMCM operates on Philippine calendar days. */
export const PRISM_BUSINESS_TIME_ZONE = "Asia/Manila";

/** The Philippine calendar date (YYYY-MM-DD) of an instant, for comparing against event dates. */
export function prismCalendarDateKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PRISM_BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Philippine time has no daylight saving: it is always UTC+8. */
export const PRISM_BUSINESS_UTC_OFFSET_HOURS = 8;

/**
 * The instant a Philippine calendar day begins, for an event date stored as that day at UTC midnight
 * (10 Oct is stored as 10 Oct 00:00 UTC and begins at 9 Oct 16:00 UTC).
 */
export function prismEventDayStart(eventDate: string | Date): Date {
  return new Date(new Date(eventDate).getTime() - PRISM_BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

/** An assignment the coordinator still works: not cancelled, replaced or declined. */
export function isActiveCoordinatorAssignmentStatus(status: string | undefined | null): boolean {
  return status !== "cancelled" && status !== "replaced" && status !== "declined";
}

/**
 * The event a coordinator's home opens on: the soonest assigned event on or after today, or the most recent one
 * when every event is past. The API resolves it for the combined role view and the portal for its selector, so
 * both always agree.
 */
export function selectCoordinatorFocusEventId(events: ReadonlyArray<{ id: string; eventDate: string }>, todayKey: string): string | undefined {
  const byDate = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return (byDate.find((event) => event.eventDate.slice(0, 10) >= todayKey) ?? byDate[byDate.length - 1])?.id;
}

/**
 * Coordinators may record their own attendance from the day before through the day after the event, counted in
 * Philippine calendar days. Outside that window the record is read-only for coordinators; PMCM corrects it.
 */
export function isWithinCoordinatorAttendanceWindow(eventDate: string, todayKey: string): boolean {
  const dayOffset = calendarDayNumber(todayKey) - calendarDayNumber(eventDate);
  return Number.isFinite(dayOffset) && Math.abs(dayOffset) <= 1;
}

/**
 * The event's calendar day lies before today, in Philippine calendar days. Once it has passed, planning and
 * live entry are over and the event moves to closure; the rule is the same for every portal.
 */
export function hasEventDatePassed(eventDate: string, todayKey: string): boolean {
  const dayOffset = calendarDayNumber(todayKey) - calendarDayNumber(eventDate);
  return Number.isFinite(dayOffset) && dayOffset > 0;
}

/** Whole days since the epoch for a YYYY-MM-DD key (or the date part of an ISO timestamp). NaN when unparseable. */
function calendarDayNumber(value: string): number {
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return Number.NaN;
  return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;
}
