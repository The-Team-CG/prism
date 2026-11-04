import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismPmcmEventSummary } from "@prism/types";

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

/** Unread messages in one line for the Messages event list. */
export function messagesSummaryLabel(summary: PrismPmcmEventSummary | undefined): SummaryLabel | null {
  if (!summary || summary.unreadMessages === 0) return { text: "No unread messages" };
  return { text: summary.unreadMessages === 1 ? "1 unread message" : `${summary.unreadMessages} unread messages`, urgent: true };
}

/** The API lists only events with something to report, so once summaries have loaded a missing event owes nothing and has nothing unread. */
export const emptyEventSummary = (eventId: string): PrismPmcmEventSummary => ({ eventId, balanceDue: 0, nextPaymentDue: null, overdueMilestones: 0, unreadMessages: 0 });

export function summariesByEvent(items: PrismPmcmEventSummary[] | undefined): Map<string, PrismPmcmEventSummary> {
  return new Map((items ?? []).map((item) => [item.eventId, item]));
}
