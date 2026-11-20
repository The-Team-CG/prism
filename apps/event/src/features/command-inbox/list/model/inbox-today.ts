import type { PrismPmcmCalendarItem } from "@prism/types";
import { addDays } from "@prism/ui/calendar-views";

/** How far ahead the Inbox looks for the next event day. */
export const INBOX_TODAY_LOOKAHEAD_DAYS = 60;
/** The "This week" line lists at most this many events after the lead. */
const WEEK_LIMIT = 3;

export type InboxTodayEvent = Pick<PrismPmcmCalendarItem, "eventId" | "eventName" | "date" | "detail" | "startTime">;

export interface InboxToday {
  /** Today's event, or the next one; null when nothing is on in the lookahead. */
  lead: (InboxTodayEvent & { live: boolean }) | null;
  /** The next few events after the lead within seven days of today. */
  week: InboxTodayEvent[];
}

/** The Inbox's lead: the event on today, or the next event day, and the few after it this week. */
export function selectInboxToday(items: PrismPmcmCalendarItem[], todayKey: string): InboxToday {
  const seen = new Set<string>();
  const events = items
    .filter((item) => item.kind === "event" && item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.eventName.localeCompare(b.eventName))
    // A multi-day event lists one item per day; the Inbox names each event once, on its first day from today.
    .filter((item) => (seen.has(item.eventId) ? false : (seen.add(item.eventId), true)))
    .map(({ eventId, eventName, date, detail, startTime }) => ({ eventId, eventName, date, detail, startTime }));
  const [lead, ...rest] = events;
  if (!lead) return { lead: null, week: [] };
  const weekEnd = addDays(todayKey, 7);
  return { lead: { ...lead, live: lead.date === todayKey }, week: rest.filter((item) => item.date <= weekEnd).slice(0, WEEK_LIMIT) };
}
