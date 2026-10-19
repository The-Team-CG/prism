import type { PrismUser } from "./core.js";
import type {
  PrismBriefing,
  PrismDocument,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismInquiry,
} from "./lifecycle.js";
import type {
  PrismSupplier,
  PrismSupplierCategory,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
} from "./commercial.js";
import type {
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorCoverage,
  PrismCoordinatorRoleRequirement,
  PrismRegistrationPlatform,
} from "./operations.js";
import type {
  PrismAdditionalBilling,
  PrismBillingCorrection,
  PrismBillingDispute,
  PrismBillingSource,
  PrismBillingStatement,
  PrismClientBillingDispute,
  PrismComplianceCheck,
  PrismComplianceRisk,
  PrismComplianceRule,
  PrismComplianceRun,
  PrismEventInsight,
  PrismPaymentMilestone,
  PrismPaymentRecord,
  PrismPostEventDocument,
} from "./compliance-billing.js";
import type { PrismAuditLog, PrismNotificationLog } from "./trust.js";

export interface PrismApprovedClientAccount {
  id: string;
  name: string;
  email: string;
}

export interface PrismEventClientAccess {
  eventId: string;
  primaryContact: { name: string; email: string };
  secondaryContacts: PrismApprovedClientAccount[];
}

export interface PrismClientSharedFloorplanEvent {
  eventId: string;
  eventName: string;
  eventDate: string;
}

export type PrismClientFloorplanSnapshotType = "submitted" | "approved";

export interface PrismClientSharedFloorplanEntry {
  eventId: string;
  eventName: string;
  eventDate: string;
  draftId: string;
  draftName: string;
  draftStatus: string;
  availableSnapshots: PrismClientFloorplanSnapshotType[];
}

export interface PrismCursorPageInfo {
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface PrismEventPage {
  items: PrismEvent[];
  pagination: PrismCursorPageInfo;
}

export interface PrismPmcmDashboardWorkspace {
  users: PrismUser[];
  inquiries: PrismInquiry[];
  events: PrismEvent[];
  documents: PrismDocument[];
  briefings: PrismBriefing[];
  supplierQuoteRequests: PrismSupplierQuoteRequest[];
  supplierQuotes: PrismSupplierQuote[];
  coordinators: PrismCoordinator[];
  coordinatorRoleRequirements: PrismCoordinatorRoleRequirement[];
  coordinatorAssignments: PrismCoordinatorAssignment[];
  complianceRules: PrismComplianceRule[];
  complianceChecks: PrismComplianceCheck[];
  billingSources: PrismBillingSource[];
  billingStatements: PrismBillingStatement[];
  paymentMilestones: PrismPaymentMilestone[];
  paymentRecords: PrismPaymentRecord[];
  billingCorrections?: PrismBillingCorrection[];
  billingDisputes?: PrismBillingDispute[];
  additionalBillings?: PrismAdditionalBilling[];
  postEventDocuments: PrismPostEventDocument[];
  eventInsights: PrismEventInsight[];
  floorPlanDrafts: PrismFloorPlanDraft[];
  supplierCategories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  auditLogs: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
}

export type PrismClientTimelineMilestoneKey =
  | "conforme_signed"
  | "proposal_accepted"
  | "floor_plan_approved"
  | "balance_payment_due"
  | "event_date";

export type PrismClientTimelineMilestoneStatus = "completed"
  | "current"
  | "pending";

export interface PrismClientTimelineMilestone<
  Key extends PrismClientTimelineMilestoneKey = PrismClientTimelineMilestoneKey,
> {
  key: Key;
  date: string | null;
  status: PrismClientTimelineMilestoneStatus;
}

export interface PrismClientEventTimeline {
  eventId: string;
  milestones: [
    PrismClientTimelineMilestone<"conforme_signed">,
    PrismClientTimelineMilestone<"proposal_accepted">,
    PrismClientTimelineMilestone<"floor_plan_approved">,
    PrismClientTimelineMilestone<"balance_payment_due">,
    PrismClientTimelineMilestone<"event_date">,
  ];
}

export type PrismOcularVisitStatus = "requested" | "scheduled" | "completed" | "waived";

export interface PrismClientOcularVisit {
  eventId: string;
  status: PrismOcularVisitStatus;
  clientNote: string | null;
  requestedAt: string | null;
  scheduledAt: string | null;
}

export interface PrismPmcmOcularVisit extends PrismClientOcularVisit {
  completedAt: string | null;
  waiverReason: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
}

export type PrismClientWorkspace = Pick<
  PrismPmcmDashboardWorkspace,
  | "users"
  | "inquiries"
  | "events"
  | "documents"
  | "briefings"
  | "supplierQuotes"
  | "coordinatorAssignments"
  | "complianceChecks"
  | "billingStatements"
  | "paymentMilestones"
  | "postEventDocuments"
  | "floorPlanDrafts"
  | "auditLogs"
  | "notificationLogs"
> & {
  pagination: PrismCursorPageInfo;
  clientEventTimelines: PrismClientEventTimeline[];
  ocularVisits?: PrismClientOcularVisit[];
  /** Client-safe dispute status on the client's own statements; PMCM reasons and resolver notes are never included. */
  billingDisputes?: PrismClientBillingDispute[];
  /** The client's own archived events for read-only history and closeout; never part of active workspace data. */
  archivedEvents?: PrismEvent[];
};

export interface PrismBillingWorkspace {
  events: PrismEvent[];
  billingSources: PrismBillingSource[];
  billingStatements: PrismBillingStatement[];
  paymentMilestones: PrismPaymentMilestone[];
  paymentRecords: PrismPaymentRecord[];
  billingCorrections?: PrismBillingCorrection[];
  billingDisputes?: PrismBillingDispute[];
  additionalBillings?: PrismAdditionalBilling[];
}

export interface PrismSupplierWorkspace {
  supplier: PrismSupplier;
  quoteRequests: PrismSupplierQuoteRequest[];
  supplierQuotes: PrismSupplierQuote[];
}

export interface PrismSupplierReadinessItem {
  id: string;
  requestId: string;
  eventId: string;
  eventName?: string | null;
  clientName?: string | null;
  category: string;
  quoteStatus: string;
  assignmentStatus?: string;
  readinessStatus?: string;
  contractStatus: "missing" | "submitted" | "accepted" | "changes_requested";
  eventDayStatus?: string;
  verificationStatus?: string;
  priority: PrismCommandInboxSeverity;
  dueAt?: string | null;
  href?: string;
}

export interface PrismSupplierReadinessBoard {
  generatedAt: string;
  supplier: PrismSupplier;
  counts: Record<PrismCommandInboxSeverity, number>;
  items: PrismSupplierReadinessItem[];
}

export type PrismCommandInboxSeverity = "critical"
  | "warning"
  | "attention"
  | "info";

export type PrismCommandInboxKind =
  | "inquiry"
  | "conforme"
  | "briefing"
  | "billing"
  | "document"
  | "floorplan"
  | "approval"
  | "supplier"
  | "coordinator"
  | "closure"
  | "live_ops"
  | "change_request"
  | "feedback";

export interface PrismCommandInboxItem {
  id: string;
  kind: PrismCommandInboxKind;
  severity: PrismCommandInboxSeverity;
  label: string;
  description: string;
  status: string;
  eventId?: string | null;
  eventName?: string | null;
  clientName?: string | null;
  dueAt?: string | null;
  createdAt?: string | null;
  href?: string;
}

export interface PrismPmcmCommandInbox {
  generatedAt: string;
  summary: {
    activeEvents: number;
    pendingInquiries: number;
    pendingApprovals: number;
  };
  page: {
    index: number;
    size: number;
    hasMore: boolean;
  };
  counts: Record<PrismCommandInboxSeverity, number>;
  items: PrismCommandInboxItem[];
}

export interface PrismPmcmEventWorkspace {
  event: PrismEvent;
  documents: PrismDocument[];
  briefings: PrismBriefing[];
  supplierQuoteRequests: PrismSupplierQuoteRequest[];
  supplierQuotes: PrismSupplierQuote[];
  coordinatorAssignments: PrismCoordinatorAssignment[];
  coordinatorCoverage?: PrismCoordinatorCoverage[];
  complianceChecks: PrismComplianceCheck[];
  complianceRuns?: PrismComplianceRun[];
  complianceRisks?: PrismComplianceRisk[];
  billingSources: PrismBillingSource[];
  billingStatements: PrismBillingStatement[];
  paymentMilestones: PrismPaymentMilestone[];
  paymentRecords: PrismPaymentRecord[];
  billingCorrections?: PrismBillingCorrection[];
  billingDisputes?: PrismBillingDispute[];
  additionalBillings?: PrismAdditionalBilling[];
  postEventDocuments: PrismPostEventDocument[];
  eventInsights: PrismEventInsight[];
  floorPlanDrafts: PrismFloorPlanDraft[];
  auditLogs: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
  registrationPlatform: PrismRegistrationPlatform | null;
  ocularVisit?: PrismPmcmOcularVisit | null;
}

export interface PrismClientActionItem {
  id: string;
  kind: Extract<
    PrismCommandInboxKind,
    "briefing"
    | "billing"
    | "document"
    | "floorplan"
    | "approval"
    | "closure"
    | "feedback"
    | "change_request"
  >;
  priority: PrismCommandInboxSeverity;
  label: string;
  description: string;
  status: string;
  eventId: string;
  eventName: string;
  dueAt?: string | null;
  href?: string;
}

export interface PrismClientActionCenter {
  generatedAt: string;
  counts: Record<PrismCommandInboxSeverity, number>;
  items: PrismClientActionItem[];
}
