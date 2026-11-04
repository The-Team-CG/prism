/** Per-event money and message facts for the PMCM event pickers (Finance, Files, Messages). */
export interface PrismPmcmEventSummary {
  eventId: string;
  /** Unpaid milestone balance across the event's current billing, in pesos. */
  balanceDue: number;
  /** Earliest due date (YYYY-MM-DD) among milestones still owed; null when nothing is owed. */
  nextPaymentDue: string | null;
  overdueMilestones: number;
  /** Messages from other people, in threads the signed-in PMCM actor belongs to, newer than their last read. */
  unreadMessages: number;
}

export interface PrismPmcmEventSummaries {
  generatedAt: string;
  items: PrismPmcmEventSummary[];
}

export type PrismPmcmCalendarItemKind =
  | "event"
  | "ocular_visit"
  | "quote_deadline"
  | "payment_due"
  | "supplier_arrival"
  | "supplier_departure";

export interface PrismPmcmCalendarItem {
  id: string;
  kind: PrismPmcmCalendarItemKind;
  eventId: string;
  eventName: string;
  /** Philippine calendar date, YYYY-MM-DD. */
  date: string;
  /** Philippine wall-clock time, HH:mm; absent for all-day items. */
  startTime?: string;
  /** A second line: the supplier and category, the milestone, the place. */
  detail: string;
}

export interface PrismPmcmCalendar {
  generatedAt: string;
  from: string;
  to: string;
  items: PrismPmcmCalendarItem[];
}
