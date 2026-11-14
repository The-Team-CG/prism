import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismPmcmEventSummary, PrismPmcmFileSummary } from "@prism/types";

export type SummaryLabel = { text: string; urgent?: boolean };

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** What an event owes, in one line for the Finance event list. */
export function financeSummaryLabel(summary: PrismPmcmEventSummary | undefined): SummaryLabel | null {
  if (!summary) return null;
  if (summary.balanceDue === 0) return { text: "Nothing owed" };
  const parts = [`${peso.format(summary.balanceDue)} due`];
  if (summary.overdueMilestones > 0) parts.push(`${summary.overdueMilestones} overdue`);
  if (summary.nextPaymentDue) parts.push(`next ${formatPortalDate(summary.nextPaymentDue)}`);
  return summary.overdueMilestones > 0 ? { text: parts.join(" · "), urgent: true } : { text: parts.join(" · ") };
}

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

/** The API lists only events with something to report, so once summaries have loaded a missing event owes nothing and has nothing unread. */
export const emptyEventSummary = (eventId: string): PrismPmcmEventSummary => ({ eventId, balanceDue: 0, nextPaymentDue: null, overdueMilestones: 0, unreadMessages: 0 });

export function summariesByEvent(items: PrismPmcmEventSummary[] | undefined): Map<string, PrismPmcmEventSummary> {
  return new Map((items ?? []).map((item) => [item.eventId, item]));
}
