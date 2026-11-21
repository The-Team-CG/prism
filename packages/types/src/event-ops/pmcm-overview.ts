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

/** Whether the event's client is keeping up: when they last signed in and the notices about this event they have not opened. */
export interface PrismPmcmClientActivity {
  eventId: string;
  /** The client's last sign-in to the portal; null when they have not signed in or have no portal account. */
  lastActiveAt: string | null;
  unreadNotices: number;
}

export interface PrismPmcmEventSummaries {
  generatedAt: string;
  items: PrismPmcmEventSummary[];
}

/** How many of an event's file requirements still need work, for the PMCM Files event list. */
export interface PrismPmcmFileSummary {
  eventId: string;
  total: number;
  /** Requirements whose status is missing or pending, the same count the event's Files tab shows. */
  open: number;
  overdue: number;
}

export interface PrismPmcmFileSummaries {
  generatedAt: string;
  items: PrismPmcmFileSummary[];
}

export type PrismPmcmCalendarItemKind =
  | "event"
  | "ocular_visit"
  | "quote_deadline"
  | "payment_due"
  | "supplier_arrival"
  | "supplier_departure"
  | "schedule_day";

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
  /** Payments only: the milestone's own name ("Downpayment") and what is still owed on it. */
  label?: string;
  amount?: number;
  /** The event-day schedule day on this date, whose run sheet this item leads to. Set on schedule days and on the event day when it has one. */
  scheduleDayId?: string;
}

export interface PrismPmcmCalendar {
  generatedAt: string;
  from: string;
  to: string;
  items: PrismPmcmCalendarItem[];
}

/** One event's facts that PMCM's client list and client profiles roll up per client. */
export interface PrismPmcmClientEventFacts {
  eventId: string;
  /** Current (not superseded or cancelled) payment milestones, in pesos. */
  billed: number;
  paid: number;
  /** The client's closeout rating (1 to 5), once they sent one. */
  closeoutRating: number | null;
  /** The event client's last portal sign-in. */
  clientLastActiveAt: string | null;
}

export interface PrismPmcmClientFacts {
  generatedAt: string;
  items: PrismPmcmClientEventFacts[];
}

/** A supplier's next confirmed booking on or after today. */
export interface PrismPmcmSupplierNextBooking {
  supplierId: string;
  eventId: string;
  eventName: string;
  /** Philippine calendar date, YYYY-MM-DD. */
  eventDate: string;
}

export interface PrismPmcmSupplierNextBookings {
  generatedAt: string;
  items: PrismPmcmSupplierNextBooking[];
}
