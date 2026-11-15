import { daysUntil, manilaCalendarKey } from "@prism/ui/format-date";
import type { PrismPmcmCalendarItem, PrismPmcmClientActivity } from "@prism/types";

/** A client this many days away from the portal is worth a nudge. */
const QUIET_DAYS = 7;
/** The dated work an overview lists before "see the calendar". */
const COMING_UP_LIMIT = 5;

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

function lastSeen(lastActiveAt: string, todayKey: string): { text: string; quiet: boolean } {
  const ago = daysUntil(todayKey, manilaCalendarKey(lastActiveAt)) ?? 0;
  if (ago <= 0) return { text: "opened the portal today", quiet: false };
  if (ago === 1) return { text: "last opened the portal yesterday", quiet: false };
  return { text: `last opened the portal ${ago} days ago`, quiet: ago >= QUIET_DAYS };
}

/**
 * Whether the client is keeping up, in one line: "Ana Reyes last opened the portal 5 days ago · 2 notices unread".
 * `quiet` marks a client who has not signed in, or not for a week, so PMCM knows to follow up another way.
 */
export function clientActivityLine(clientName: string, activity: PrismPmcmClientActivity, todayKey: string): { text: string; quiet: boolean } {
  const seen = activity.lastActiveAt ? lastSeen(activity.lastActiveAt, todayKey) : { text: "has not signed in to the portal yet", quiet: true };
  const unread = activity.unreadNotices > 0 ? ` · ${plural(activity.unreadNotices, "notice")} unread` : "";
  return { text: `${clientName} ${seen.text}${unread}`, quiet: seen.quiet };
}

/** The event's own dated work from the PMCM calendar, soonest first; the event day itself is already the countdown. */
export function eventComingUp(items: PrismPmcmCalendarItem[], eventId: string): PrismPmcmCalendarItem[] {
  return items
    .filter((item) => item.eventId === eventId && item.kind !== "event")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""))
    .slice(0, COMING_UP_LIMIT);
}
