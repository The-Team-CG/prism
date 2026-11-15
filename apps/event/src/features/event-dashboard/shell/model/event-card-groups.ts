import { derivePrismLifecycleStage, type PrismCommandInboxItem, type PrismEvent, type PrismPmcmEventAttention } from "@prism/types";
import type { AttentionLine } from "@prism/ui/event-cards";

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

/** The Inbox items an event card lists, as card lines that open the work. */
export function attentionLines(items: PrismCommandInboxItem[]): AttentionLine[] {
  return items.map((item) => ({ id: item.id, severity: item.severity, text: item.label, detail: item.description || undefined, href: item.href }));
}
