import { derivePrismLifecycleStage, type PrismCommandInboxItem, type PrismEvent, type PrismPmcmEventAttention } from "@prism/types";
import type { AttentionLine } from "@prism/ui/event-cards";
import { daysUntil, manilaCalendarKey } from "@prism/ui/format-date";

export type EventCardGroups = { needsYou: PrismEvent[]; comingUp: PrismEvent[]; done: PrismEvent[] };

/** Something on the event waits on PMCM; an event with only informational items is not urgent. */
export function needsPmcm(attention: PrismPmcmEventAttention | undefined): boolean {
  if (!attention) return false;
  return attention.counts.critical + attention.counts.warning + attention.counts.attention > 0;
}

function isDone(event: PrismEvent): boolean {
  return derivePrismLifecycleStage(event) === "closure_archive" || /^cancelled$/i.test(event.status);
}

const byDate = (a: PrismEvent, b: PrismEvent) => a.eventDate.localeCompare(b.eventDate);

/**
 * Events in the order PMCM works them: what waits on PMCM first (most critical items, then soonest), then what is
 * coming up by date, then finished events, newest first. Until the Inbox read arrives (`attention` undefined)
 * nothing is called "needs you" or put under Done for lack of it: active events stay under Coming up.
 */
export function groupEventCards(events: PrismEvent[], attention: Map<string, PrismPmcmEventAttention> | undefined): EventCardGroups {
  const needsYou: PrismEvent[] = [];
  const comingUp: PrismEvent[] = [];
  const done: PrismEvent[] = [];
  for (const event of events) {
    if (needsPmcm(attention?.get(event.id))) needsYou.push(event);
    else if (isDone(event)) done.push(event);
    else comingUp.push(event);
  }
  const critical = (event: PrismEvent) => attention?.get(event.id)?.counts.critical ?? 0;
  needsYou.sort((a, b) => critical(b) - critical(a) || byDate(a, b));
  comingUp.sort(byDate);
  done.sort((a, b) => byDate(b, a));
  return { needsYou, comingUp, done };
}

/** A waiting item is worth chasing once it has sat this many days. */
const STALE_DAYS = 3;

const days = (count: number) => `${count} day${count === 1 ? "" : "s"}`;

function dueAge(left: number | null): Pick<AttentionLine, "age" | "late"> {
  if (left === null) return {};
  if (left < 0) return { age: `overdue ${days(-left)}`, late: true };
  if (left === 0) return { age: "due today", late: true };
  return { age: left === 1 ? "due tomorrow" : `due in ${days(left)}` };
}

function waitingAge(waited: number | null): Pick<AttentionLine, "age" | "late"> {
  if (waited === null) return {};
  if (waited <= 0) return { age: "new today" };
  return { age: `waiting ${days(waited)}`, late: waited >= STALE_DAYS };
}

/**
 * How long an Inbox item has waited, or when it is due, in Philippine calendar days: a due date says how close or
 * late it is ("due tomorrow", "overdue 2 days"); otherwise the age since it arrived ("waiting 6 days").
 */
export function attentionAge(item: Pick<PrismCommandInboxItem, "dueAt" | "createdAt">, todayKey: string): Pick<AttentionLine, "age" | "late"> {
  if (item.dueAt) return dueAge(daysUntil(manilaCalendarKey(item.dueAt), todayKey));
  if (item.createdAt) return waitingAge(daysUntil(todayKey, manilaCalendarKey(item.createdAt)));
  return {};
}

/** The Inbox items an event card lists, as card lines that open the work and say how long each has waited. */
export function attentionLines(items: PrismCommandInboxItem[], todayKey: string): AttentionLine[] {
  return items.map((item) => ({ id: item.id, severity: item.severity, text: item.label, detail: item.description || undefined, href: item.href, ...attentionAge(item, todayKey) }));
}
