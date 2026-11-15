import type { PrismPmcmEventSummary, PrismPmcmFileSummary } from "@prism/types";

export type SummaryLabel = { text: string; urgent?: boolean };

/** How much file work is left, in one line for the Files event list; nothing for an event the read did not cover. */
export function fileSummaryLabel(summary: PrismPmcmFileSummary | undefined): SummaryLabel | null {
  if (!summary || summary.total === 0) return null;
  if (summary.open === 0) return { text: "All requirements met" };
  const text = `${summary.open} of ${summary.total} requirements open${summary.overdue > 0 ? ` · ${summary.overdue} overdue` : ""}`;
  return summary.overdue > 0 ? { text, urgent: true } : { text };
}

/** The counts an event card's shortcuts show: payments overdue, file requirements still open, unread messages. */
export type EventShortcutCounts = { billing?: number; files?: number; messages?: number };

/** Shortcut counts for one event; a count the reads have not arrived for is left out rather than shown as zero. */
export function eventShortcutCounts(finance: PrismPmcmEventSummary | undefined, files: PrismPmcmFileSummary | undefined): EventShortcutCounts {
  return { billing: finance?.overdueMilestones, files: files?.open, messages: finance?.unreadMessages };
}

export function summariesByEvent(items: PrismPmcmEventSummary[] | undefined): Map<string, PrismPmcmEventSummary> {
  return new Map((items ?? []).map((item) => [item.eventId, item]));
}
