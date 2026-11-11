import type { PrismPlanApplyResult, PrismPlanPreview } from "./planning.js";

/** A selected supplier booking the date change would touch, and why it needs a second look. */
export interface PrismDateChangeSupplier {
  requestId: string;
  supplierId: string | null;
  supplierName: string;
  category: string;
  assignmentStatus: string;
  /** Plain-words reasons the supplier may not be able to serve the new date. Empty when none is known. */
  conflicts: string[];
}

export type PrismDateChangePaymentState = "paid" | "partial" | "open";

/** A payment milestone. Money received is never changed; only an unpaid balance can be given a new due date, by PMCM, in Billing. */
export interface PrismDateChangePayment {
  milestoneId: string;
  label: string;
  amount: number;
  amountPaid: number;
  remaining: number;
  dueDate: string;
  state: PrismDateChangePaymentState;
  /** The due date moved by the same number of days, offered only for a balance still owed. Never applied from here. */
  suggestedDueDate: string | null;
}

export type PrismDateChangeApprovedKind = "conforme" | "proposal" | "floorplan" | "billing";

/** Work the client already signed or approved. It is preserved exactly; PMCM decides whether the client must reconfirm. */
export interface PrismDateChangeApprovedWork {
  kind: PrismDateChangeApprovedKind;
  label: string;
  detail: string;
}

/** The plan, one preview per template the event follows, each at the version the event already has. */
export interface PrismDateChangePlan {
  templates: PrismPlanPreview[];
  /** Open tasks that would move. */
  movable: number;
  /** Tasks that would have moved but are done, skipped or edited, so they stay. */
  kept: number;
}

export interface PrismDateChangeImpact {
  eventId: string;
  eventName: string;
  currentDate: string;
  /** The date being checked, or null when the event's current date is. */
  newDate: string | null;
  shiftDays: number | null;
  /** The plan can follow the event only once the event has the new date; a date that is only being considered cannot be applied. */
  planApplicable: boolean;
  plan: PrismDateChangePlan;
  suppliers: PrismDateChangeSupplier[];
  payments: PrismDateChangePayment[];
  approvedWork: PrismDateChangeApprovedWork[];
}

export type PrismDateChangePlanApplyResult = PrismPlanApplyResult;
