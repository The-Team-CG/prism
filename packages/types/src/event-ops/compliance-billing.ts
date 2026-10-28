import type { PrismAddendumConformeTraceReference } from "../conforme-signing.js";
import type { PrismFileRequirementsMatrix } from "./lifecycle.js";

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
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  recordedAt: string;
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
  };
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
