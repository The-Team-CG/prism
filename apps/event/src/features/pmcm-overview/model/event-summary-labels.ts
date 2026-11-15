import type { PrismPmcmEventSummary, PrismPmcmFileSummary } from "@prism/types";

export type SummaryLabel = { text: string; urgent?: boolean };

/** How much file work is left, in one line for the Files event list; nothing for an event the read did not cover. */
export function fileSummaryLabel(summary: PrismPmcmFileSummary | undefined): SummaryLabel | null {
  if (!summary || summary.total === 0) return null;
  if (summary.open === 0) return { text: "All requirements met" };
  const text = `${summary.open} of ${summary.total} requirements open${summary.overdue > 0 ? ` · ${summary.overdue} overdue` : ""}`;
  return summary.overdue > 0 ? { text, urgent: true } : { text };
}

/** What on one event needs the PMCM now: overdue payments, overdue file requirements and unread messages. Empty when nothing does. */
export function eventAttentionLabels(finance: PrismPmcmEventSummary | undefined, files: PrismPmcmFileSummary | undefined): string[] {
  const labels: string[] = [];
  if (finance && finance.overdueMilestones > 0) labels.push(finance.overdueMilestones === 1 ? "1 payment overdue" : `${finance.overdueMilestones} payments overdue`);
  if (files && files.overdue > 0) labels.push(files.overdue === 1 ? "1 file overdue" : `${files.overdue} files overdue`);
  if (finance && finance.unreadMessages > 0) labels.push(finance.unreadMessages === 1 ? "1 unread message" : `${finance.unreadMessages} unread messages`);
  return labels;
}

export function summariesByEvent(items: PrismPmcmEventSummary[] | undefined): Map<string, PrismPmcmEventSummary> {
  return new Map((items ?? []).map((item) => [item.eventId, item]));
}
