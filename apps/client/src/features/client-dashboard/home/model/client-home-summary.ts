import { daysUntil, dueLabel, manilaCalendarKey } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import type { ClientDashboardAction } from "../../workspace/model/client-dashboard-view-rules";
import type { ClientRowTone } from "../../shared/client-list-ui";

const PAST_STATUSES = new Set(["completed", "cancelled", "closed"]);

export function isPastClientEvent(event: Pick<PrismEvent, "status" | "archived">) {
  return event.archived || PAST_STATUSES.has(event.status);
}

/** Upcoming events soonest first, then past events most recent first. */
export function orderClientEvents<T extends Pick<PrismEvent, "status" | "archived" | "eventDate">>(events: T[]): T[] {
  const upcoming = events.filter((event) => !isPastClientEvent(event)).sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
  const past = events.filter(isPastClientEvent).sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
  return [...upcoming, ...past];
}

/** "In 12 days", "Today", "Tomorrow", "3 days ago": how far an event date is from today in Manila. */
export function eventCountdown(eventDate: string | null | undefined, todayKey: string): string | null {
  if (!eventDate) return null;
  const days = daysUntil(manilaCalendarKey(eventDate), todayKey);
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return days === -1 ? "Yesterday" : `${-days} days ago`;
}

/** Due phrase and urgency for a dated item; undated items have neither. */
export function dueState(dueAt: string | null | undefined, todayKey: string): { label: string; tone: ClientRowTone } | null {
  if (!dueAt) return null;
  const days = daysUntil(manilaCalendarKey(dueAt), todayKey);
  if (days === null) return null;
  return { label: dueLabel(days), tone: days < 0 ? "urgent" : days <= 2 ? "attention" : "neutral" };
}

/** Row colour for a client action: blockers are red or orange, later requirements stay grey. */
export function clientActionRowTone(action: ClientDashboardAction): ClientRowTone {
  if (action.priority === "critical") return "urgent";
  if (action.blocking || action.priority === "attention") return "attention";
  return "neutral";
}

/** The client's own actions, most urgent first: blockers, then what holds a stage back, then the rest. Order within each is kept. */
export function orderClientActionsByUrgency(actions: ClientDashboardAction[]): ClientDashboardAction[] {
  const rank = (action: ClientDashboardAction) => (action.priority === "critical" ? 0 : action.blocking || action.priority === "attention" ? 1 : 2);
  return actions.map((action, index) => ({ action, index })).sort((a, b) => rank(a.action) - rank(b.action) || a.index - b.index).map((entry) => entry.action);
}

export type ClientHomeLead = { event: PrismEvent; action?: ClientDashboardAction; daysToGo: number | null };

/**
 * The event the client home leads with and that event's most urgent step.
 * It is the next event still ahead on the calendar, so the page opens on what is coming up; a blocker
 * on another event takes the lead instead, because that is what the client must see first.
 */
export function clientHomeLead(events: PrismEvent[], own: ClientDashboardAction[], todayKey: string): ClientHomeLead | null {
  const ordered = orderClientActionsByUrgency(own);
  const upcoming = orderClientEvents(events).filter((event) => !isPastClientEvent(event));
  const daysTo = (event: PrismEvent) => (event.eventDate ? daysUntil(manilaCalendarKey(event.eventDate), todayKey) : null);
  const blocker = ordered.find((action) => action.priority === "critical");
  const blocked = blocker ? events.find((event) => event.id === blocker.eventId) : undefined;
  const event = blocked ?? upcoming.find((candidate) => (daysTo(candidate) ?? -1) >= 0) ?? upcoming[0];
  if (!event) return null;
  return { event, action: ordered.find((action) => action.eventId === event.id), daysToGo: daysTo(event) };
}

/** "Good morning" before noon, "Good afternoon" until six, "Good evening" after. */
export function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  return hour < 18 ? "Good afternoon" : "Good evening";
}

/** One sentence under the Home title that says how much is waiting on the client. */
export function clientHomeSummaryLine(own: ClientDashboardAction[]): string {
  if (own.length === 0) return "Nothing needs you right now.";
  const events = new Set(own.map((action) => action.eventId ?? "")).size;
  const things = own.length === 1 ? "1 thing needs you" : `${own.length} things need you`;
  return events > 1 ? `${things} across ${events} events.` : `${things}.`;
}
