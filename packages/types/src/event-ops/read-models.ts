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

/**
 * @deprecated Compatibility shape for local seed/reset/demo paths. New app
 * contracts should use role-specific workspaces such as
 * PrismPmcmDashboardWorkspace, PrismClientWorkspace, PrismSupplierWorkspace,
 * billing workspaces, or event-specific read models.
 */
export interface PrismSampleState extends PrismPmcmDashboardWorkspace {}

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
>;

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
  contractStatus: "missing" | "uploaded";
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

export type PrismCommandInboxSeverity =
  | "critical"
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
}

export interface PrismClientActionItem {
  id: string;
  kind: Extract<
    PrismCommandInboxKind,
    | "briefing"
    | "billing"
    | "document"
    | "floorplan"
    | "approval"
    | "closure"
    | "feedback"
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
