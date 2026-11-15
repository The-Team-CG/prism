import type { PrismPmcmEventSummary, PrismPmcmFileSummary } from "@prism/types";

export type SummaryLabel = { text: string; urgent?: boolean };

/** How much file work is left, in one line for the Files event list; nothing for an event the read did not cover. */
export function fileSummaryLabel(summary: PrismPmcmFileSummary | undefined): SummaryLabel | null {
  if (!summary || summary.total === 0) return null;
  if (summary.open === 0) return { text: "All requirements met" };
  const text = `${summary.open} of ${summary.total} requirements open${summary.overdue > 0 ? ` · ${summary.overdue} overdue` : ""}`;
  return summary.overdue > 0 ? { text, urgent: true } : { text };
}

/**
 * What PMCM checks on an event that the Inbox does not carry: unread messages and overdue file requirements. Money and
 * other blockers come from the Inbox's own items. Empty when there is nothing, or before the reads arrive.
 */
export function eventNotes(finance: PrismPmcmEventSummary | undefined, files: PrismPmcmFileSummary | undefined): string[] {
  const notes: string[] = [];
  if (finance && finance.unreadMessages > 0) notes.push(finance.unreadMessages === 1 ? "1 unread message" : `${finance.unreadMessages} unread messages`);
  if (files && files.overdue > 0) notes.push(files.overdue === 1 ? "1 file overdue" : `${files.overdue} files overdue`);
  return notes;
}

export function summariesByEvent(items: PrismPmcmEventSummary[] | undefined): Map<string, PrismPmcmEventSummary> {
  return new Map((items ?? []).map((item) => [item.eventId, item]));
}
