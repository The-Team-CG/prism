import type { PrismPmcmEventSummary, PrismPmcmFileSummary } from "@prism/types";

/** The counts an event card's shortcuts show: payments overdue, file requirements still open, unread messages. */
export type EventShortcutCounts = { billing?: number; files?: number; messages?: number };

/** Shortcut counts for one event; a count the reads have not arrived for is left out rather than shown as zero. */
export function eventShortcutCounts(finance: PrismPmcmEventSummary | undefined, files: PrismPmcmFileSummary | undefined): EventShortcutCounts {
  return { billing: finance?.overdueMilestones, files: files?.open, messages: finance?.unreadMessages };
}

export function summariesByEvent(items: PrismPmcmEventSummary[] | undefined): Map<string, PrismPmcmEventSummary> {
  return new Map((items ?? []).map((item) => [item.eventId, item]));
}
