export interface PrismProjectLike {
  objects: unknown[];
  guests: unknown[];
  suppliers: unknown[];
}
export type SampleRole = "pmcm-admin" | "client" | "coordinator" | "supplier";

export const PRISM_EVENT_OPS_ACTOR_ROLES = [
  "pmcm-admin",
  "client",
  "coordinator",
  "supplier",
  "guest",
  "system",
  "unknown",
] as const;

export type PrismEventOpsActorRole = (typeof PRISM_EVENT_OPS_ACTOR_ROLES)[number];

export interface PrismEventOpsActorContext {
  id?: string;
  actorId?: string;
  role?: PrismEventOpsActorRole | string;
  actorRole?: PrismEventOpsActorRole | string;
  email?: string;
  actorEmail?: string;
  name?: string;
  actorName?: string;
  clientName?: string;
  supplierId?: string;
  coordinatorId?: string;
  eventId?: string;
  accessCode?: string;
}

export interface PrismUser {
  id: string;
  name: string;
  role: SampleRole;
  email: string;
  organization: string;
  approvalStatus: "approved" | "pending" | string;
  lastLoginAt?: string | null;
  lockedUntil?: string | null;
  permanentLockout?: boolean;
}

export interface PrismInquiry {
  id: string;
  clientName: string;
  companyName: string;
  email: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  clientType: string;
  source: "Facebook" | "Website" | "BNI" | "Walk-In" | "Log on Behalf" | string;
  normalizedEmail?: string;
  referralDetails?: string;
  loggedByRole?: string | null;
  loggedByName?: string | null;
  duplicateOfInquiryId?: string | null;
  previousDeclinedInquiryId?: string | null;
  previousDeclineReason?: string | null;
  duplicate?: boolean;
  previouslyDeclined?: boolean;
  message: string;
  status: string;
  declineReason?: string | null;
  acceptedAt?: string | null;
  pendingAt?: string | null;
  declinedAt?: string | null;
  conformeSentAt?: string | null;
  conformeSignedAt?: string | null;
  portalActivatedAt?: string | null;
  followUpIntervalDays?: number;
  lastConformeReminderAt?: string | null;
  reminderDueAt?: string | null;
  reminderDue?: boolean;
  portalInvitationStatus?: "not_sent" | "sent" | "opened" | "expired" | string;
  portalInvitationSentAt?: string | null;
  portalInvitationOpenedAt?: string | null;
  portalInvitationExpiresAt?: string | null;
  createdAt: string;
}

export interface PrismFloorPlanPreference {
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string[];
  notes?: string;
}

export interface PrismFloorPlanSnapshot {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects?: PrismProjectLike["objects"];
  guests?: PrismProjectLike["guests"];
  suppliers?: PrismProjectLike["suppliers"];
  seats?: unknown[];
  seatCategories?: unknown[];
  updatedAt?: string;
}

export interface PrismFloorPlanDraft {
  id: string;
  eventId: string;
  floorPlanId: string;
  name: string;
  status: "client_submitted" | "pmcm_draft" | "in_review" | "approved" | string;
  isActive: boolean;
  sourceType: "client_preference" | "blank" | "template" | string;
  createdByRole?: SampleRole | string;
  clientPreference?: PrismFloorPlanPreference;
  submittedSnapshot?: PrismFloorPlanSnapshot;
  approvedSnapshot?: PrismFloorPlanSnapshot;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  submittedSnapshotAt?: string;
  approvedSnapshotAt?: string;
  revisionComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrismEvent {
  id: string;
  inquiryId: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  status: string;
  clientPortalStatus: "locked" | "unlocked";
  readiness: string;
  archived: boolean;
  floorPlanStatus: string;
  floorPlanId?: string | null;
  guestAccessCode?: string;
  activeFloorPlanDraftId?: string;
  floorPlanDrafts?: PrismFloorPlanDraft[];
}

export interface PrismDefenseReadinessAction {
  key: string;
  label: string;
  detail: string;
  status: "done" | "attention" | "blocked";
  targetTab: string;
}

export interface PrismDefenseReadiness {
  eventId: string;
  eventName: string;
  overallStatus: "ready" | "attention" | "blocked";
  lifecycleStage: string;
  score: number;
  summary: {
    briefingSubmitted: boolean;
    officialFloorplanApproved: boolean;
    quoteRequests: number;
    selectedSuppliers: number;
    coordinatorAssignments: number;
    pendingCoordinatorAcknowledgments: number;
    openLiveOpsItems: number;
    billingStatements: number;
    unpaidMilestones: number;
    guestAttendanceCount: number;
    pendingFeedbackModeration: number;
    closureReady: boolean;
  };
  nextActions: PrismDefenseReadinessAction[];
  liveAiBlocked: boolean;
  deferredScope: string[];
  generatedAt: string;
}

export interface PrismDocument {
  id: string;
  eventId: string;
  type: string;
  fileName: string;
  status: string;
  uploadedAt: string;
}

export type PrismFileRequirementStatus = "missing" | "pending" | "submitted" | "generated" | "approved" | "complete";

export interface PrismFileRequirementItem {
  key: string;
  label: string;
  ownerRole: string;
  visibleToRoles: string[];
  sourceWorkflow: string;
  status: PrismFileRequirementStatus;
  dueDate?: string;
  uploadedAssetId?: string;
  generatedDocumentId?: string;
  auditCategory: string;
  detail: string;
}

export interface PrismFileRequirementsMatrix {
  eventId: string;
  items: PrismFileRequirementItem[];
}

export interface PrismBriefing {
  eventId: string;
  venue: string;
  guestCount: number;
  budgetRange: string;
  serviceRequirements: string[];
  notes: string;
  submittedAt: string;
}

export interface PrismSupplierQuote {
  id: string;
  eventId: string;
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName: string;
  category: string;
  amount: number;
  inclusions: string[];
  paymentTerms: string;
  notes: string;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
  outsideAcceptableRange: boolean;
  status: string;
  revisionNumber?: number;
  revisedAt?: string | null;
  selectedAt?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PrismSupplierQuoteRequest {
  id: string;
  eventId: string;
  supplierId?: string;
  categoryId?: string;
  supplierName: string;
  category: string;
  message: string;
  dueDate?: string | null;
  accessToken: string;
  confidentialBid: boolean;
  status: string;
  assignmentStatus?: string;
  assignmentConfirmedAt?: string | null;
  readinessStatus?: string;
  readinessConfirmedAt?: string | null;
  readinessNotes?: string;
  eventDayStatus?: string;
  eventDayStatusAt?: string | null;
  eventDayNotes?: string;
  eventDayVerificationStatus?: string;
  eventDayVerifiedAt?: string | null;
  eventDayVerifiedBy?: string | null;
  eventDayVerificationNotes?: string;
  verificationStatus?: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  verificationNotes?: string;
  statusPhotoFileName?: string | null;
  contractDocumentId?: string | null;
  createdAt: string;
}

export type PrismSupplierTier = "tier_1" | "tier_2" | "pending_first_event" | string;

export interface PrismSupplierCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
}

export interface PrismSupplierPastEvent {
  id: string;
  eventName: string;
  clientName: string;
  eventDate: string;
}

export interface PrismSupplierReview {
  id: string;
  rating: number;
  notes: string;
  reviewedBy: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
}

export interface PrismSupplierReliabilityNote {
  id: string;
  note: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
}

export interface PrismSupplierCertification {
  id: string;
  fileName: string;
  documentType?: string;
  issuer?: string;
  expiresAt?: string | null;
  status?: string;
  notes?: string;
  uploadedAt: string;
}

export interface PrismSupplier {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tier: PrismSupplierTier;
  bniMember: boolean;
  autoTrust: boolean;
  contactName: string;
  email: string;
  phone: string;
  serviceInclusions: string;
  performanceNotes: string;
  applicationDate: string;
  aggregateRating: number | null;
  lastEventDate: string | null;
  pastEvents: PrismSupplierPastEvent[];
  reviews: PrismSupplierReview[];
  reliabilityNotes: PrismSupplierReliabilityNote[];
  certifications: PrismSupplierCertification[];
}

export interface PrismCoordinatorAssignment {
  id: string;
  eventId: string;
  coordinatorId?: string | null;
  coordinatorName: string;
  role: string;
  status: string;
  attendanceStatus?: string;
  attendanceMarkedAt?: string | null;
  attendanceNotes?: string;
  replacedByAssignmentId?: string | null;
  replacementReason?: string;
  replacedAt?: string | null;
  replacedBy?: string | null;
  doubleBookingWarning: boolean;
  eventDate?: string | null;
  conflictEventId?: string | null;
  conflictEventName?: string | null;
  acknowledgedAt?: string | null;
  createdAt?: string;
}

export interface PrismCoordinator {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  photoUrl?: string | null;
  roleTags: string[];
  skillsTags: string[];
  active: boolean;
  createdAt: string;
}

export interface PrismCoordinatorRoleRequirement {
  role: string;
  required: number;
}

export interface PrismGuestCheckIn {
  id: string;
  eventId: string;
  guestName: string;
  checkInMode: string;
  status: string;
  walkIn: boolean;
  verificationStatus: string;
  checkedInAt: string;
}

export interface PrismEventDayTask {
  id: string;
  eventId: string;
  title: string;
  assignedRole: string;
  ownerName: string;
  priority: string;
  status: "open" | "in_progress" | "done" | "blocked" | string;
  notes: string;
  dueAt?: string | null;
  slaDueAt?: string | null;
  slaStatus?: "on_track" | "due_soon" | "overdue" | "resolved" | string;
  escalationLevel?: "none" | "role_lead" | "pmcm" | "critical" | string;
  escalatedAt?: string | null;
  escalatedBy?: string | null;
  escalationNotes?: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrismUrgentIssue {
  id: string;
  eventId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "assigned" | "resolved" | "cancelled" | string;
  ownerRole: string;
  ownerName: string;
  resolution: string;
  openedBy: string;
  slaDueAt?: string | null;
  slaStatus?: "on_track" | "due_soon" | "overdue" | "resolved" | string;
  escalationLevel?: "none" | "role_lead" | "pmcm" | "critical" | string;
  escalatedAt?: string | null;
  escalatedBy?: string | null;
  escalationNotes?: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrismEventDayLog {
  id: string;
  eventId: string;
  actionType: string;
  actor: string;
  actorRole: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface PrismLiveOps {
  event: PrismEvent;
  role?: string;
  tasks: PrismEventDayTask[];
  urgentIssues: PrismUrgentIssue[];
  supplierStatuses: PrismSupplierQuoteRequest[];
  coordinatorAssignments: PrismCoordinatorAssignment[];
  guestAttendanceCount: number;
  guestCheckIns: PrismGuestCheckIn[];
  eventDayLogs: PrismEventDayLog[];
}

export interface PrismEventDayStatusFeedItem {
  id: string;
  type: "task" | "urgent_issue" | "supplier_status" | string;
  title: string;
  status: string;
  role?: string;
  slaStatus?: string;
  escalationLevel?: string;
  verificationStatus?: string;
}

export interface PrismEventDayStatusFeed {
  event: PrismEvent;
  role?: string;
  items: PrismEventDayStatusFeedItem[];
  coordinatorAssignments: PrismCoordinatorAssignment[];
  eventDayLogs: PrismEventDayLog[];
  guestAttendanceCount: number;
  guestCheckIns: PrismGuestCheckIn[];
}

export interface PrismCoordinatorWorkspace {
  coordinator: PrismCoordinator;
  assignments: PrismCoordinatorAssignment[];
  events: PrismEvent[];
}

export interface PrismCoordinatorRoleView extends PrismLiveOps {
  assignment: PrismCoordinatorAssignment;
  role: string;
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
}

export interface PrismBillingSource {
  id: string;
  eventId: string;
  sourceType: string;
  sourceLabel: string;
  sourceDocumentId?: string | null;
  lineItems: Array<{ label: string; amount: number }>;
  paymentSchedule: Array<{ label: string; percentage: number; amount?: number; dueDate?: string }>;
  paymentMethods: Array<{ label: string; details: string }>;
  totalAmount: number;
  status: "draft" | "approved" | string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrismBillingStatement {
  id: string;
  eventId: string;
  sourceId?: string | null;
  number: string;
  clientName: string;
  clientContact: string;
  eventName: string;
  eventDate?: string | null;
  lineItems: Array<{ label: string; amount: number }>;
  paymentSchedule: Array<{ label: string; percentage: number; amount: number; dueDate?: string }>;
  paymentMethods: Array<{ label: string; details: string }>;
  totalAmount: number;
  documentId?: string | null;
  pdfUrl: string;
  storageKey: string;
  status: string;
  sentAt?: string | null;
  generatedAt: string;
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

export interface PrismEventInsight {
  id: string;
  eventId: string;
  summary: string;
  highlights: string[];
  risks: Array<{ title: string; severity: string; status: string }>;
  supplierNotes: Array<{ supplierId: string; rating: number; notes: string; reviewedBy: string }>;
  financialSummary: { billingCount?: number; totalBilled?: number; amountPaid?: number; outstandingAmount?: number };
  documentSummary: { total?: number; submitted?: number; pendingPostEventDocuments?: number };
  feedbackSummary: { feedbackDocuments?: number; supplierReviews?: number; clientFeedbackSubmitted?: boolean };
  privateNotes: string;
  generatedAt: string;
  updatedAt: string;
}

export interface PrismAuditLog {
  id: string;
  eventId?: string;
  actor: string;
  actorRole: string;
  actorEmail?: string;
  action: string;
  actionType: string;
  category: string;
  affectedType?: string;
  affectedId?: string;
  affectedLabel?: string;
  metadata?: unknown;
  ipAddress: string;
  device: string;
  severity: string;
  immutableHash: string;
  previousHash?: string;
  createdAt: string;
}

export interface PrismLoginHistory {
  id: string;
  userId?: string;
  userName: string;
  userRole: string;
  email: string;
  status: string;
  ipAddress: string;
  device: string;
  failureReason?: string;
  createdAt: string;
}

export interface PrismSecurityAlert {
  id: string;
  eventId?: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  triggeredBy: string;
  metadata?: unknown;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface PrismAuditIntegrity {
  valid: boolean;
  checkedCount: number;
  firstBrokenLogId?: string | null;
  lastVerifiedHash?: string | null;
  checkedAt: string;
}

export interface PrismPrivacyInventorySurface {
  surface: string;
  recordCount: number;
  dataCategories: string[];
  consentAcceptedCount: number;
  missingConsentCount: number;
  privacyNoticeVersions: string[];
}

export interface PrismPrivacyInventoryEvent {
  eventId: string;
  eventName: string;
  dataCategories: string[];
  recordCount: number;
  surfaces: PrismPrivacyInventorySurface[];
  retentionNotes: string;
}

export interface PrismPrivacyInventory {
  generatedAt: string;
  events: PrismPrivacyInventoryEvent[];
  globalSurfaces: PrismPrivacyInventorySurface[];
  retentionNotes: string[];
}

export interface PrismPrivacyRetentionPolicy {
  surface: string;
  dataCategories: string[];
  retentionPeriod: string;
  deletionBehavior: string;
}

export interface PrismPrivacyRequest {
  id: string;
  eventId?: string | null;
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  requestType: "access" | "correction" | "deletion" | "export" | string;
  status: "submitted" | "approved" | "rejected" | "executed" | string;
  requestNotes: string;
  reviewReason: string;
  executionNotes: string;
  createdBy: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  executedBy?: string | null;
  executedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrismAuditExport {
  exportedAt: string;
  recordCount: number;
  rows: PrismAuditLog[];
}

export interface PrismNotificationLog {
  id: string;
  eventId?: string;
  channel: "email" | "viber" | "zoom" | "canva" | "storage" | "ai" | string;
  recipient: string;
  message: string;
  status: string;
  attempts: number;
  correlationId?: string | null;
  failureReason?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface PrismApprovalRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  status: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
  requestedAt: string;
}

export interface PrismSampleState {
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
  postEventDocuments: PrismPostEventDocument[];
  eventInsights: PrismEventInsight[];
  floorPlanDrafts: PrismFloorPlanDraft[];
  supplierCategories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  auditLogs: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
}

export type PrismPmcmDashboardWorkspace = PrismSampleState;

export type PrismClientWorkspace = Pick<
  PrismSampleState,
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
}

export interface PrismSupplierWorkspace {
  supplier: PrismSupplier;
  quoteRequests: PrismSupplierQuoteRequest[];
  supplierQuotes: PrismSupplierQuote[];
}

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

type CreateSupplierReviewInput = {
  eventId?: string;
  rating: number;
  notes: string;
  reviewedBy?: string;
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
  paymentSchedule?: Array<{ label: string; percentage: number; dueDate?: string }>;
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
  ownerRole?: string;
  ownerName?: string;
  openedBy?: string;
  slaDueAt?: string;
};

type UpdateUrgentIssueInput = {
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
  markedBy?: string;
};

type VerifySupplierStatusInput = {
  verificationStatus: "self_reported" | "verified" | "disputed";
  verifiedBy?: string;
  notes?: string;
};

type CreatePrivacyRequestInput = {
  subjectType: string;
  subjectEmail?: string;
  subjectName?: string;
  eventId?: string;
  requestType: "access" | "correction" | "deletion" | "export";
  requestNotes?: string;
};

type ReviewPrivacyRequestInput = {
  status: "approved" | "rejected";
  reviewReason?: string;
};

type AuditLogFilters = {
  query?: string;
  category?: string;
  eventId?: string;
  actor?: string;
  actionType?: string;
  severity?: string;
  dateRange?: string;
  limit?: string;
};

// ─── PARE types ───────────────────────────────────────────────────────────────

export type PARECandidate = {
  supplierId: string;
  supplierName: string;
  tier: string;
  quotedAmount: number;
  reliabilityScore: number;
  halal: boolean;
  priorPmcmEvents: number;
  reason: string;
};

export type PAREBudgetAnalysis = {
  feasible: boolean;
  selectedCandidate: PARECandidate;
  costDelta: number;
  costDeltaLabel: string;
  summary: string;
};

export type PARERisk = {
  level: "LOW" | "MEDIUM" | "HIGH";
  factors: string[];
  recommendation: string;
};

export type PAREDrafts = {
  supplierNotification: string;
  clientReassurance: string;
};

export type PAREResult = {
  eventId: string;
  withdrawnSupplier: { id: string; name: string; category: string; tier: string; quotedAmount: number };
  candidates: PARECandidate[];
  budgetAnalysis: PAREBudgetAnalysis;
  riskAssessment: PARERisk;
  drafts: PAREDrafts;
  mode: "mock" | "live";
  triggeredAt: string;
};

export type PAREApprovalRecord = {
  id: string;
  eventId: string;
  requestId: string;
  status: "pending" | "approved" | "rejected";
  pareResult: PAREResult;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

