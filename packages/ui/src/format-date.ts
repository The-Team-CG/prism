const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Calendar dates keep their day; timestamps are displayed in Philippine time. */
export function formatPortalDate(value?: string | null, fallback = "Date not set"): string {
  if (!value) return fallback;
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(calendarDate ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-PH", { ...dateOptions, timeZone: calendarDate ? "UTC" : "Asia/Manila" }).format(date);
}

export function formatPortalDateTime(value?: string | null, fallback = "Time not set"): string {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatPortalDate(value, fallback);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-PH", { ...dateOptions, hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(date);
}

/** The Philippine calendar date (YYYY-MM-DD) of an instant, for comparing against calendar due dates. */
export function manilaDateKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function formatPortalTime(value?: string | null, fallback = "Time not set"): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(date);
}

/** The Philippine calendar date of a value: calendar dates keep their day, timestamps resolve in Manila. */
export function manilaCalendarKey(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : manilaDateKey(new Date(value));
}

/** Whole days between two Philippine calendar dates (YYYY-MM-DD): negative when the due date has passed. */
export function daysUntil(dueKey: string, todayKey: string): number | null {
  const due = Date.parse(`${dueKey}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(today)) return null;
  return Math.round((due - today) / 86_400_000);
}

/** Short due phrase for a list row: "Overdue 3 days", "Due today", "Due in 2 days". */
export function dueLabel(days: number): string {
  if (days < -1) return `Overdue ${-days} days`;
  if (days === -1) return "Overdue 1 day";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
