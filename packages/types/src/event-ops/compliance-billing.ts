import type { PrismAddendumConformeTraceReference } from "../conforme-signing.js";
import type { PrismFileRequirementsMatrix } from "./lifecycle.js";
import type { BillingDiscrepancySeverity } from "../schemas/session-commercial-inputs.js";

export interface PrismBillingLineItem {
  label: string;
  amount: number;
  /** Set on addendum scope-change lines; the conforme trace is matched by this id. */
  addendumId?: string;
  /** Set on addendum scope-change lines once the addendum conforme is executed. */
  addendumConforme?: PrismAddendumConformeTraceReference;
}

export interface PrismComplianceCheck {
  id: string;
  eventId: string;
  ruleId?: string | null;
  layer: "Must-Fix" | "Should-Fix" | "Advisory";
  severity?: string;
  phase?: string;
  conditionKey?: string;
  title: string;
  status: "open" | "resolved" | "overridden";
  note: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  overrideReason?: string | null;
  overrideAt?: string | null;
  overrideBy?: string | null;
  evaluationStatus: "satisfied" | "not_satisfied" | "not_applicable";
  evidence: string[];
  definitionStatus: "DERIVED" | "PROVISIONAL" | string;
  remediation: string;
  runId?: string | null;
}

export interface PrismComplianceRun {
  id: string;
  eventId: string;
  phase: string;
  trigger: "manual" | "scheduled" | "state_change" | string;
  status: "running" | "completed" | "failed" | string;
  startedAt: string;
  completedAt?: string | null;
  ruleCount: number;
  createdAt: string;
  checks?: PrismComplianceCheck[];
}

export interface PrismComplianceRisk {
  id: string;
  eventId: string;
  phase: string;
  ruleId?: string | null;
  title: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  /** How likely the risk is; null when it was recorded without one (rule-raised risks and older entries). */
  likelihood?: "low" | "medium" | "high" | null;
  /** How much it would hurt the event if it happened. */
  impact?: "low" | "medium" | "high" | null;
  owner: string;
  mitigation: string;
  status: "open" | "mitigated" | "accepted" | "closed" | string;
  source: "rule" | "pmcm" | string;
  closedAt?: string | null;
  closedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    id: string;
    action: string;
    actor: string;
    reason: string;
    createdAt: string;
  }>;
}

export interface PrismComplianceRule {
  id: string;
  eventId?: string | null;
  eventType: string;
  phase: string;
  severity: string;
  layer: "Must-Fix" | "Should-Fix" | "Advisory" | string;
  conditionKey: string;
  title: string;
  note: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  definitionStatus?: "DERIVED" | "PROVISIONAL" | string;
  remediation?: string;
  phaseApplicability?: string[];
}

export interface PrismBillingSource {
  id: string;
  eventId: string;
  sourceType: string;
  sourceLabel: string;
  sourceDocumentId?: string | null;
  lineItems: PrismBillingLineItem[];
  paymentSchedule: Array<{
    label: string;
    percentage: number;
    amount?: number;
    dueDate?: string;
  }>;
  paymentMethods: Array<{ label: string; details: string }>;
  totalAmount: number;
  status: "draft" | "approved" | string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvalNotes: string;
  paymentTermsPolicyState?:
    | "standard"
    | "repeat_client_override"
    | "pending_owner_decision"
    | string;
  paymentTermsOverrideReason?: string | null;
  paymentTermsApprovedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrismBillingStatement {
  id: string;
  eventId: string;
  sourceId?: string | null;
  supersedesStatementId?: string | null;
  number: string;
  clientName: string;
  clientContact: string;
  eventName: string;
  eventDate?: string | null;
  lineItems: PrismBillingLineItem[];
  paymentSchedule: Array<{
    label: string;
    percentage: number;
    amount: number;
    dueDate?: string;
  }>;
  paymentMethods: Array<{ label: string; details: string }>;
  totalAmount: number;
  documentId?: string | null;
  pdfUrl: string;
  storageKey?: string;
  storageObjectId?: string | null;
  storageState?: "stored" | "failed" | "pending" | string;
  status: string;
  sentAt?: string | null;
  generatedAt: string;
}

export interface PrismBillingCorrection {
  id: string;
  eventId: string;
  statementId: string;
  replacementStatementId?: string | null;
  reason: string;
  severity: BillingDiscrepancySeverity;
  correctedTotalAmount?: number | null;
  status: string;
  requestedBy: string;
  /** Verified actor id of the requester; null for corrections requested before the id was recorded. */
  requestedById?: string | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface PrismBillingDispute {
  id: string;
  eventId: string;
  statementId: string;
  milestoneId?: string | null;
  amount: number;
  reason: string;
  severity: BillingDiscrepancySeverity;
  status: string;
  raisedBy: string;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

/** Client-safe dispute projection: status and amount only; PMCM reasons, resolver notes, and actors stay internal. */
export interface PrismClientBillingDispute {
  id: string;
  eventId: string;
  statementId: string;
  milestoneId?: string | null;
  amount: number;
  severity: BillingDiscrepancySeverity;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface PrismAdditionalBilling {
  id: string;
  eventId: string;
  urgentIssueId: string;
  billingSourceId?: string | null;
  description: string;
  amount: number;
  status: string;
  createdBy: string;
  waiverReason?: string | null;
  waivedBy?: string | null;
  createdAt: string;
  waivedAt?: string | null;
}

export interface PrismPaymentRecord {
  id: string;
  eventId: string;
  milestoneId: string;
  /** Negative on a reversal, which undoes the payment named by reversesRecordId. */
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  recordedAt: string;
  /** The receipt this amount was applied from. Absent on records that predate receipts. */
  receiptId?: string | null;
  reversesRecordId?: string | null;
}

export type PrismPaymentReceiptStatus = "recorded" | "verified" | "rejected" | "reversed";

/** One slice of a receipt applied to a milestone. A reversed slice stays listed, with the reversal that undid it. */
export interface PrismPaymentReceiptAllocation {
  id: string;
  eventId: string;
  milestoneId: string;
  milestoneLabel: string | null;
  amount: number;
  reversed: boolean;
  reversalId: string | null;
  reversalReason: string | null;
  recordedAt: string;
}

export interface PrismPaymentRefund {
  id: string;
  amount: number;
  refundedDate: string;
  method: string;
  referenceNumber: string;
  reason: string;
  recordedBy: string;
  recordedAt: string;
}

export interface PrismPaymentReceiptEvidence {
  objectId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

/** Money that arrived outside P.R.I.S.M. `unapplied` is what is left after allocations and refunds. */
export interface PrismPaymentReceipt {
  id: string;
  amount: number;
  receivedDate: string;
  method: string;
  referenceNumber: string;
  payerName: string;
  eventId: string | null;
  notes: string;
  status: PrismPaymentReceiptStatus;
  /** Who recorded it: PMCM finance, or the client telling PMCM they paid. */
  source: "pmcm" | "client";
  /** The payment the client said this money was for. PMCM still decides where it goes. */
  intendedMilestoneId: string | null;
  intendedMilestoneLabel: string | null;
  /** A receipt carried over from a payment recorded before receipts existed: no evidence, never checked. */
  legacy: boolean;
  evidenceObjectId: string | null;
  /** The stored proof of payment (a bank statement line, a screenshot), when one was attached and is still held. */
  evidence: PrismPaymentReceiptEvidence | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verificationNotes: string | null;
  rejectionReason: string | null;
  reversalReason: string | null;
  /** Another live receipt with the same amount, method, date and payer: worth a look, not a block. */
  possibleDuplicateOfId: string | null;
  applied: number;
  refunded: number;
  unapplied: number;
  allocations: PrismPaymentReceiptAllocation[];
  refunds: PrismPaymentRefund[];
  recordedBy: string;
  recordedAt: string;
}

/**
 * One supplier category: what the proposal estimated for it (the price shown to the client), what the selected supplier
 * quotes commit PMCM to, and what has been paid to suppliers so far. Whole pesos.
 */
export interface PrismFinancialCategoryLine {
  category: string;
  estimatedPrice: number;
  committedCost: number;
  actualCost: number;
  /** Estimated price less committed cost: what this category is expected to leave. */
  expectedMargin: number;
}

/**
 * Where one event stands: the price (estimated and billed), what has been collected and how far to trust it, what supplier
 * cost is committed and paid, and the margin that follows. Every figure is whole pesos; `notes` says where one is not yet reliable.
 */
export interface PrismEventFinancialSummary {
  eventId: string;
  eventName: string;
  generatedAt: string;
  price: {
    /** The latest proposal cost estimate: the price PMCM told the client to expect. */
    estimated: number | null;
    estimateStatus: "draft" | "approved" | null;
    /** The current billing statement total. */
    billed: number | null;
    statementNumber: string | null;
  };
  collections: {
    /** All active payment milestones. */
    scheduled: number;
    /** Cash applied to milestones from receipts, reversals netted out. */
    received: number;
    /** Credit applied to milestones, which is not cash received. */
    credit: number;
    outstanding: number;
    /** Outstanding on milestones already past due. */
    overdue: number;
    /** Part of what was received that comes from receipts verified against a statement. */
    verifiedReceived: number;
    /** The rest: recorded but not yet checked, or carried over from before receipts. */
    unverifiedReceived: number;
    /** Received for this event but not applied to any milestone. */
    unapplied: number;
  };
  costs: {
    /** Selected and locked supplier quotes. */
    committed: number;
    /** Payment schedules created for suppliers. */
    scheduled: number;
    /** Released to suppliers, reversals netted out. */
    actual: number;
    /** Committed less actual, never below zero. */
    toPay: number;
  };
  margin: {
    /** Price less committed cost. Null until there is a price. */
    expected: number | null;
    /** Which price the expected margin used. */
    basis: "statement" | "estimate" | null;
    /** Received less paid to suppliers so far. */
    cashToDate: number;
  };
  categories: PrismFinancialCategoryLine[];
  /** Plain statements of where the figures above should not be taken at face value. */
  notes: string[];
}

/** One line of a statement of account. A reversed payment stays listed, marked, and is left out of every total. */
export interface PrismStatementOfAccountLine {
  id: string;
  /** ISO date. */
  date: string;
  kind: "payment" | "credit" | "refund";
  description: string;
  method: string;
  reference: string;
  /** Always positive; the kind says which way the money went. */
  amount: number;
  reversed: boolean;
}

/** Where a payment the client sent stands with PMCM: still being checked, matched and counted, or not accepted. */
export type PrismPaymentSubmissionState = "checking" | "accepted" | "not_accepted";

/**
 * A payment the client needs to hear about: one PMCM is still checking, one PMCM did not accept, and one the client
 * reported that PMCM has since accepted. Only the rejection reason is carried; PMCM's checking notes stay internal.
 */
export interface PrismPaymentSubmission {
  id: string;
  amount: number;
  /** ISO date the money was sent. */
  paidDate: string;
  method: string;
  reference: string;
  state: PrismPaymentSubmissionState;
  /** Why PMCM did not accept it. Written for the client, who sees it. */
  reason: string | null;
  /** The payment it was meant for or has been applied to, when known. */
  forPayment: string | null;
  /** Part of the amount not yet applied to any payment. */
  unapplied: number;
  /** True when the client reported it, false when PMCM recorded it. */
  fromClient: boolean;
  hasProof: boolean;
}

/** One payment on the schedule as a client sees it. */
export interface PrismStatementMilestone {
  id: string;
  label: string;
  dueDate: string;
  amount: number;
  paid: number;
  remaining: number;
  status: string;
  /** Part of `paid` that came from money PMCM has not finished checking. */
  checking: number;
  /** Amount under an open dispute on this payment. */
  disputed: number;
  /** ISO date it was paid in full, when it is. */
  settledOn: string | null;
}

/**
 * What a client sees of an event's money: billed, received, paid back, credit PMCM is holding, and what is still owed.
 * It carries no PMCM notes or payer details: amounts, dates, methods, the references the client used, and why a payment
 * was not accepted.
 */
export interface PrismStatementOfAccount {
  eventId: string;
  eventName: string;
  generatedAt: string;
  /** False until PMCM sends the billing statement: a client sees nothing before then. Everything below is then empty. */
  available: boolean;
  statementNumber: string | null;
  billed: number;
  /** Cash applied to the milestones plus credit carried from an earlier statement, reversals netted out. */
  received: number;
  /** Money paid back from what was held unapplied. */
  refunded: number;
  /** Received for this event, checked by PMCM and held: not applied to a milestone and not paid back. */
  creditHeld: number;
  /** Still owed on the current milestones. */
  balance: number;
  /** Amount under open disputes that name no single payment. */
  disputedOnStatement: number;
  milestones: PrismStatementMilestone[];
  /** How to pay, as printed on the billing statement. */
  paymentMethods: Array<{ label: string; details: string }>;
  /** Payments being checked, not accepted, or reported by the client and since accepted. Newest first. */
  submissions: PrismPaymentSubmission[];
  /** Oldest first. */
  lines: PrismStatementOfAccountLine[];
}

/** A milestone a receipt can be applied to: still owed, not superseded. */
export interface PrismPaymentAllocationTarget {
  milestoneId: string;
  eventId: string;
  eventName: string;
  label: string;
  amount: number;
  remainingBalance: number;
  dueDate: string;
  status: string;
}

export interface PrismPaymentMilestone {
  overdue?: boolean;
  supersededAt?: string | null;
  id: string;
  eventId: string;
  label: string;
  percentage: number;
  amount: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate: string;
  status: string;
  history: PrismPaymentRecord[];
}

export interface PrismPostEventDocument {
  id: string;
  eventId: string;
  title: string;
  status: string;
}

export interface PrismCloseGate {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PrismCloseGates {
  eventId: string;
  ready: boolean;
  gates: PrismCloseGate[];
  missingKeys: string[];
  matrix?: PrismFileRequirementsMatrix;
}

export interface PrismWrapUpSection {
  status: "pending" | "complete" | "blocked";
  evidence: string;
  completedAt: string | null;
}

export interface PrismWrapUpBillingDraftItem {
  label: string;
  amount: number;
  note: string;
}

export interface PrismWrapUpBillingDraftSection extends PrismWrapUpSection {
  items: PrismWrapUpBillingDraftItem[];
}

/** Confirmed suppliers and whether each has reported leaving the venue; read live, not stored. */
export interface PrismWrapUpSupplierEgressSummary {
  confirmedSuppliers: number;
  leftSite: number;
  outstanding: string[];
}

export interface PrismEventWrapUp {
  id: string;
  eventId: string;
  mode: "full" | "quick";
  status: "pending" | "complete";
  activatedAt: string;
  deadlineAt: string;
  twelveHourReminderAt: string | null;
  twentyFourHourReminderAt: string | null;
  requiredItems: Record<string, boolean>;
  sections: {
    logistics: PrismWrapUpSection;
    issues: PrismWrapUpSection;
    feedback: PrismWrapUpSection;
    supplierEgress: PrismWrapUpSection;
    billingDraft: PrismWrapUpBillingDraftSection;
  };
  supplierEgressSummary?: PrismWrapUpSupplierEgressSummary;
  clientAcknowledgedAt: string | null;
  acknowledgementRecordedBy: string | null;
  acknowledgementSource: "pmcm_recorded" | "client";
  clientAcknowledgementNote: string;
  completedAt: string | null;
  completedBy: string | null;
}

export interface PrismEventInsight {
  id: string;
  eventId: string;
  summary: string;
  highlights: string[];
  risks: Array<{ title: string; severity: string; status: string }>;
  supplierNotes: Array<{
    supplierId: string;
    rating: number;
    notes: string;
    reviewedBy: string;
  }>;
  financialSummary: {
    billingCount?: number;
    totalBilled?: number;
    amountPaid?: number;
    outstandingAmount?: number;
  };
  documentSummary: {
    total?: number;
    submitted?: number;
    pendingPostEventDocuments?: number;
  };
  feedbackSummary: {
    feedbackDocuments?: number;
    supplierReviews?: number;
    clientFeedbackSubmitted?: boolean;
  };
  dimensions: Record<
    string,
    {
      status: "evidence" | "pending" | "blocked";
      summary: string;
      evidence: string[];
    }
  >;
  privateNotes: string;
  generatedAt: string;
  updatedAt: string;
}

/** What PMCM finance should act on, across every event. */
export type PrismFinanceDeskItemKind =
  | "client_overdue"
  | "verify_payment"
  | "apply_money"
  | "dispute"
  | "correction"
  | "supplier_overdue"
  | "supplier_due_soon"
  | "approve_source"
  | "send_statement";

export interface PrismFinanceDeskItem {
  id: string;
  kind: PrismFinanceDeskItemKind;
  severity: "critical" | "warning" | "info";
  eventId: string | null;
  eventName: string | null;
  title: string;
  detail: string;
  amount: number;
  /** ISO date that makes it urgent: a due date, or the day the money arrived. */
  date: string | null;
  /** Where PMCM acts on it. */
  href: string;
}

/** One event's money as finance sees it: the statement, its payments and what is still out. */
export interface PrismFinanceDeskEvent {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  clientName: string;
  statementNumber: string | null;
  statementSent: boolean;
  billed: number;
  paid: number;
  /** Part of `paid` from money not yet verified. */
  checking: number;
  balance: number;
  overdue: number;
  milestones: PrismStatementMilestone[];
}

/** A payment PMCM owes a supplier. */
export interface PrismFinanceDeskPayout {
  id: string;
  eventId: string;
  eventName: string;
  supplierName: string;
  label: string;
  amount: number;
  released: number;
  dueDate: string | null;
  status: string;
}

/** Finance across every active event: what needs PMCM, each event's money, and what PMCM owes suppliers. */
export interface PrismFinanceDesk {
  generatedAt: string;
  totals: {
    clientOverdue: number;
    clientDueSoon: number;
    toVerify: number;
    toVerifyCount: number;
    unapplied: number;
    openDisputes: number;
    pendingCorrections: number;
    supplierOverdue: number;
    supplierDueSoon: number;
  };
  queue: PrismFinanceDeskItem[];
  events: PrismFinanceDeskEvent[];
  payouts: PrismFinanceDeskPayout[];
}

/** A reminder PMCM sent the client about one payment. One per payment per day: a second the same day is not sent. */
export interface PrismPaymentReminder {
  milestoneId: string;
  /** Philippine calendar date of the reminder. */
  remindedOn: string;
  /** True when a reminder had already gone out today, so this request sent nothing new. */
  alreadySentToday: boolean;
}
