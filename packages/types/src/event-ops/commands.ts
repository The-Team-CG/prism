import type { PrismAddendumConformeExecution } from "../conforme-signing.js";
import type { PrismProjectLike } from "./core.js";

type CreateFloorPlanDraftInput = {
  name: string;
  sourceType: "blank" | "template" | "client_preference";
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  objects?: PrismProjectLike["objects"];
  guests?: PrismProjectLike["guests"];
  suppliers?: PrismProjectLike["suppliers"];
};

export interface PrismCostEstimateLine {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  sourceLineId?: string | null;
}

export interface PrismCostEstimate {
  id: string;
  eventId: string;
  budgetAmount: number;
  totalAmount: number;
  alignment: "within_budget" | "over_budget";
  status: "draft" | "approved";
  lines: PrismCostEstimateLine[];
  notes: string;
  createdAt: string;
}

export interface PrismProposalVersion {
  id: string;
  eventId: string;
  versionNumber: number;
  title: string;
  summary: string;
  costEstimateId: string;
  totalAmount: number;
  status: "draft" | "issued" | "superseded";
  revisionNote: string;
  issuedAt?: string | null;
}

/** What the client sees of an issued proposal: no cost estimate lines or internal estimate ids. */
export interface PrismIssuedProposalSummary {
  id: string;
  eventId: string;
  versionNumber: number;
  title: string;
  summary: string;
  totalAmount: number;
  revisionNote: string;
  issuedAt: string;
  /** The client's decision on the current event proposal: approved means a new version can no longer be issued. */
  clientStatus: "pending" | "approved" | "revision_requested";
}

export interface PrismEventProposalResponse {
  proposal: PrismIssuedProposalSummary | null;
}

export type PrismAddendumStatus = "issued";

export interface PrismAddendum {
  id: string;
  eventId: string;
  versionNumber: number;
  title: string;
  summary: string;
  status: PrismAddendumStatus;
  documentId: string;
  documentState: "pending" | "available";
  signatureMethod: "scanned_document";
  comparison: { contract: unknown[]; quotes: unknown[] };
  financialDelta: number;
  issuedAt: string;
  /** In-app conforme for this addendum version; null until PMCM requests signing. */
  conforme: PrismAddendumConformeExecution | null;
}

export interface PrismEventFreezeException {
  id: string;
  eventId: string;
  requestedChange: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  decidedBy?: string | null;
  decisionNote?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  // Set once an approved exception has been used by a decision or addendum; approvals are single-use.
  consumedAt?: string | null;
}

/**
 * Client-safe view of a change request. Internal reasons, decision notes, impact flags, freeze exception ids,
 * and actor names are deliberately absent; clients see the requested change, where it stands, and the
 * client-visible response PMCM wrote for it.
 */
export interface PrismClientChangeRequest {
  id: string;
  source: "freeze_exception" | "scope_change";
  requestedChange: string;
  category: "program" | "venue" | "guest_count" | "styling" | "supplier" | "schedule" | "other" | null;
  status: "under_review" | "approved" | "not_approved" | "withdrawn";
  clientResponse: string | null;
  updatedAt: string;
}

type AddSupplierQuoteInput = {
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName?: string;
  category?: string;
  amount?: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
  status?: string;
};

type RequestSupplierQuotesInput = {
  categoryId: string;
  supplierIds?: string[];
  confidentialBid?: boolean;
  deadline?: string;
};

type CreateSupplierInput = {
  categoryId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  tier?: "tier_1" | "tier_2" | "pending_first_event";
  bniMember?: boolean;
  serviceInclusions?: string;
  performanceNotes?: string;
};

type UpdateSupplierInput = Partial<CreateSupplierInput>;

type ChangeSupplierTierInput = {
  tier: "tier_1" | "tier_2" | "pending_first_event";
  reason: string;
};

type CreateSupplierCertificationInput = {
  fileName: string;
  documentType: string;
  issuer?: string;
  expiresAt?: string;
  status?: "submitted" | "verified" | "expired" | "rejected";
  notes?: string;
};

type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
  referenceNumber?: string;
};

type CreateComplianceRuleInput = {
  eventType?: string;
  phase?: string;
  severity?: string;
  layer?: string;
  conditionKey: string;
  title: string;
  note?: string;
  active?: boolean;
};

type ResolveComplianceInput = {
  action?: "resolve" | "override";
  note?: string;
  overrideReason?: string;
  actorName?: string;
};

type CreateBillingSourceInput = {
  sourceType?: string;
  sourceLabel: string;
  sourceDocumentId?: string;
  lineItems: Array<{ label: string; amount: number }>;
  paymentSchedule?: Array<{
    label: string;
    percentage: number;
    dueDate?: string;
  }>;
  paymentMethods?: Array<{ label: string; details: string }>;
};

type AssignCoordinatorInput = {
  coordinatorId: string;
  role: string;
  overrideConflict?: boolean;
};

type CreateEventDayTaskInput = {
  title: string;
  assignedRole?: string;
  ownerName?: string;
  priority?: string;
  notes?: string;
  dueAt?: string;
  slaDueAt?: string;
};

type UpdateEventDayTaskInput = {
  status?: "open" | "in_progress" | "done" | "blocked";
  notes?: string;
  ownerName?: string;
  slaDueAt?: string;
};

type CreateUrgentIssueInput = {
  title: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  affectedArea?: string;
  ownerRole?: string;
  ownerName?: string;
  slaDueAt?: string;
};

type UpdateUrgentIssueInput = {
  affectedArea?: string;
  status?: "open" | "assigned" | "resolved" | "cancelled";
  ownerRole?: string;
  ownerName?: string;
  resolution?: string;
  slaDueAt?: string;
};

type EscalateLiveOpsInput = {
  escalationLevel: "role_lead" | "pmcm" | "critical";
  notes: string;
  ownerRole?: string;
  ownerName?: string;
};

type ReplaceCoordinatorInput = {
  replacementCoordinatorId: string;
  role: string;
  reason: string;
};

type UpdateCoordinatorAttendanceInput = {
  status: "present" | "late" | "absent" | "replaced";
  notes?: string;
};

type VerifySupplierStatusInput = {
  verificationStatus: "self_reported" | "verified" | "disputed";
  notes?: string;
};
