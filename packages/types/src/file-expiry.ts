import { calendarDayNumber, prismCalendarDateKey } from "./coordinator-focus.js";

/** Warn this many Philippine calendar days before a stored document's valid-until day. */
export const FILE_EXPIRY_WARNING_DAYS = 30;

export type StoredFileExpiryState = "valid" | "expiring" | "expired";

/** The Philippine calendar day (YYYY-MM-DD) a valid-until instant falls on. */
export function storedFileExpiryDay(expiresAt: string | Date): string {
  return prismCalendarDateKey(new Date(expiresAt));
}

/**
 * Whether a document with a valid-until instant is still valid, compared by Philippine calendar day. The valid-until
 * day itself is valid; the file expires from the day after, so a date stored as midnight UTC (8am in Manila) never
 * reads as expired on its own day.
 */
export function storedFileExpiryState(expiresAt: string | Date, now: Date = new Date()): StoredFileExpiryState {
  const daysLeft = calendarDayNumber(storedFileExpiryDay(expiresAt)) - calendarDayNumber(prismCalendarDateKey(now));
  if (daysLeft < 0) return "expired";
  return daysLeft <= FILE_EXPIRY_WARNING_DAYS ? "expiring" : "valid";
}
