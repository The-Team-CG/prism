import { derivePrismLifecycleStage, type PrismCommandInboxItem, type PrismEvent, type PrismLifecycleStage, type PrismPmcmEventAttention } from "@prism/types";
import type { AttentionLine } from "@prism/ui/event-cards";
import { daysUntil, manilaCalendarKey } from "@prism/ui/format-date";

/** Something on the event waits on PMCM; an event with only informational items is not urgent. */
export function needsPmcm(attention: PrismPmcmEventAttention | undefined): boolean {
  if (!attention) return false;
  return attention.counts.critical + attention.counts.warning + attention.counts.attention > 0;
}

function isDone(event: PrismEvent): boolean {
  return derivePrismLifecycleStage(event) === "closure_archive" || /^cancelled$/i.test(event.status);
}

const byDate = (a: PrismEvent, b: PrismEvent) => a.eventDate.localeCompare(b.eventDate);

/** Events this close get a full card; the rest are rows. */
export const EVENT_CARD_WINDOW_DAYS = 14;

/** The stages an event can be in while PMCM still works it, in order. */
export const ACTIVE_EVENT_STAGES: PrismLifecycleStage[] = ["conforme", "briefing_proposal", "planning", "event_day"];

export type EventRegisterPlan = {
  /** On today or within the card window, soonest first: drawn as full cards. */
  near: PrismEvent[];
  /** Everything else still being worked, as rows: events whose date has passed first (they are owed a close-out), then by date. */
  later: PrismEvent[];
  /** Finished or cancelled, newest first. */
  done: PrismEvent[];
  /** How many active events sit in each stage, for the stage filter. */
  stages: Array<{ stage: PrismLifecycleStage; count: number }>;
};

/**
 * The Events page's layout: full cards only for what is close, one row each for the rest, finished events last. It
 * replaces a grid of large cards for every event, most of which repeated the same three pending items.
 */
export function planEventRegister(events: PrismEvent[], todayKey: string): EventRegisterPlan {
  const near: PrismEvent[] = [];
  const later: PrismEvent[] = [];
  const done: PrismEvent[] = [];
  for (const event of events) {
    if (isDone(event)) {
      done.push(event);
      continue;
    }
    const days = daysUntil(event.eventDate.slice(0, 10), todayKey);
    if (days !== null && days >= 0 && days <= EVENT_CARD_WINDOW_DAYS) near.push(event);
    else later.push(event);
  }
  near.sort(byDate);
  later.sort(byDate);
  done.sort((a, b) => byDate(b, a));
  const active = [...near, ...later];
  const stages = ACTIVE_EVENT_STAGES
    .map((stage) => ({ stage, count: active.filter((event) => derivePrismLifecycleStage(event) === stage).length }))
    .filter((entry) => entry.count > 0);
  return { near, later, done, stages };
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
