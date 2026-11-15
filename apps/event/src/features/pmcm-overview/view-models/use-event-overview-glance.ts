"use client";

import { useResource } from "@prism/portal-query";
import { addDays } from "@prism/ui/calendar-views";
import { manilaDateKey } from "@prism/ui/format-date";
import type { PrismPmcmCalendarItem, PrismPmcmClientActivity, PrismPmcmEventAttention } from "@prism/types";
import { pmcmCalendar, pmcmClientActivity, pmcmEventSummaries, pmcmFileSummaries, pmcmOneEventAttention } from "../data/pmcm-overview-resources";
import { eventShortcutCounts, type EventShortcutCounts } from "../model/event-summary-labels";
import { eventComingUp } from "../model/event-overview-glance";

/** How far ahead an event's overview looks for dated work. */
const COMING_UP_DAYS = 30;

/**
 * What one event's overview shows beside its own workspace: what the Inbox has waiting on it, whether the client is
 * keeping up, its dated work for the next month, and the counts behind its shortcuts. Each is undefined until read.
 */
export type EventOverviewGlance = {
  todayKey: string;
  /** null once read when nothing waits on the event. */
  attention?: PrismPmcmEventAttention | null;
  clientActivity?: PrismPmcmClientActivity;
  comingUp?: PrismPmcmCalendarItem[];
  shortcuts: EventShortcutCounts;
};

export function useEventOverviewGlance(eventId: string | null): EventOverviewGlance {
  const todayKey = manilaDateKey();
  const attention = useResource(pmcmOneEventAttention, eventId).data;
  const activity = useResource(pmcmClientActivity, eventId).data;
  const calendar = useResource(pmcmCalendar, { from: todayKey, to: addDays(todayKey, COMING_UP_DAYS) }).data;
  const finance = useResource(pmcmEventSummaries, "signed-in").data;
  const files = useResource(pmcmFileSummaries, "signed-in").data;
  return {
    todayKey,
    // A read that arrived without this event means nothing is waiting on it.
    attention: attention ? attention.items.find((item) => item.eventId === eventId) ?? null : undefined,
    clientActivity: activity,
    comingUp: calendar && eventId ? eventComingUp(calendar.items, eventId) : undefined,
    shortcuts: eventShortcutCounts(finance?.items.find((item) => item.eventId === eventId), files?.items.find((item) => item.eventId === eventId)),
  };
}
