/** PMCM operates on Philippine calendar days. */
export const PRISM_BUSINESS_TIME_ZONE = "Asia/Manila";

/** The Philippine calendar date (YYYY-MM-DD) of an instant, for comparing against event dates. */
export function prismCalendarDateKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PRISM_BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
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
