export interface MvpProjectLike {
  objects: unknown[];
  guests: unknown[];
  suppliers: unknown[];
}
export type DemoRole = "pmcm-admin" | "client" | "coordinator" | "supplier";

export interface MvpUser {
  id: string;
  name: string;
  role: DemoRole;
  email: string;
  organization: string;
  approvalStatus: "approved" | "pending" | string;
  lastLoginAt?: string | null;
  lockedUntil?: string | null;
  permanentLockout?: boolean;
}

export interface MvpInquiry {
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

export interface MvpFloorPlanPreference {
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string[];
  notes?: string;
}

export interface MvpFloorPlanSnapshot {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects?: MvpProjectLike["objects"];
  guests?: MvpProjectLike["guests"];
  suppliers?: MvpProjectLike["suppliers"];
  seats?: unknown[];
  seatCategories?: unknown[];
  updatedAt?: string;
}

export interface MvpFloorPlanDraft {
  id: string;
  eventId: string;
  floorPlanId: string;
  name: string;
  status: "client_submitted" | "pmcm_draft" | "in_review" | "approved" | string;
  isActive: boolean;
  sourceType: "client_preference" | "blank" | "template" | string;
  createdByRole?: DemoRole | string;
  clientPreference?: MvpFloorPlanPreference;
  submittedSnapshot?: MvpFloorPlanSnapshot;
  approvedSnapshot?: MvpFloorPlanSnapshot;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  submittedSnapshotAt?: string;
  approvedSnapshotAt?: string;
  revisionComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MvpEvent {
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
  floorPlanDrafts?: MvpFloorPlanDraft[];
}

export interface MvpDefenseReadinessAction {
  key: string;
  label: string;
  detail: string;
  status: "done" | "attention" | "blocked";
  targetTab: string;
}

export interface MvpDefenseReadiness {
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
  nextActions: MvpDefenseReadinessAction[];
  liveAiBlocked: boolean;
  deferredScope: string[];
  generatedAt: string;
}

export interface MvpDocument {
  id: string;
  eventId: string;
  type: string;
  fileName: string;
  status: string;
  uploadedAt: string;
}

export interface MvpBriefing {
  eventId: string;
  venue: string;
  guestCount: number;
  budgetRange: string;
  serviceRequirements: string[];
  notes: string;
  submittedAt: string;
}

export interface MvpSupplierQuote {
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

export interface MvpSupplierQuoteRequest {
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

export type MvpSupplierTier = "tier_1" | "tier_2" | "pending_first_event" | string;

export interface MvpSupplierCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
}

export interface MvpSupplierPastEvent {
  id: string;
  eventName: string;
  clientName: string;
  eventDate: string;
}

export interface MvpSupplierReview {
  id: string;
  rating: number;
  notes: string;
  reviewedBy: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
}

export interface MvpSupplierReliabilityNote {
  id: string;
  note: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
}

export interface MvpSupplierCertification {
  id: string;
  fileName: string;
  documentType?: string;
  issuer?: string;
  expiresAt?: string | null;
  status?: string;
  notes?: string;
  uploadedAt: string;
}

export interface MvpSupplier {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tier: MvpSupplierTier;
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
  pastEvents: MvpSupplierPastEvent[];
  reviews: MvpSupplierReview[];
  reliabilityNotes: MvpSupplierReliabilityNote[];
  certifications: MvpSupplierCertification[];
}

export interface MvpCoordinatorAssignment {
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

export interface MvpCoordinator {
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

export interface MvpCoordinatorRoleRequirement {
  role: string;
  required: number;
}

export interface MvpGuestCheckIn {
  id: string;
  eventId: string;
  guestName: string;
  checkInMode: string;
  status: string;
  walkIn: boolean;
  verificationStatus: string;
  checkedInAt: string;
}

export interface MvpEventDayTask {
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

export interface MvpUrgentIssue {
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

export interface MvpEventDayLog {
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

export interface MvpLiveOps {
  event: MvpEvent;
  role?: string;
  tasks: MvpEventDayTask[];
  urgentIssues: MvpUrgentIssue[];
  supplierStatuses: MvpSupplierQuoteRequest[];
  coordinatorAssignments: MvpCoordinatorAssignment[];
  guestAttendanceCount: number;
  guestCheckIns: MvpGuestCheckIn[];
  eventDayLogs: MvpEventDayLog[];
}

export interface MvpEventDayStatusFeedItem {
  id: string;
  type: "task" | "urgent_issue" | "supplier_status" | string;
  title: string;
  status: string;
  role?: string;
  slaStatus?: string;
  escalationLevel?: string;
  verificationStatus?: string;
}

export interface MvpEventDayStatusFeed {
  event: MvpEvent;
  role?: string;
  items: MvpEventDayStatusFeedItem[];
  coordinatorAssignments: MvpCoordinatorAssignment[];
  eventDayLogs: MvpEventDayLog[];
  guestAttendanceCount: number;
  guestCheckIns: MvpGuestCheckIn[];
}

export interface MvpCoordinatorWorkspace {
  coordinator: MvpCoordinator;
  assignments: MvpCoordinatorAssignment[];
  events: MvpEvent[];
}

export interface MvpCoordinatorRoleView extends MvpLiveOps {
  assignment: MvpCoordinatorAssignment;
  role: string;
}

export interface MvpComplianceCheck {
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

export interface MvpComplianceRule {
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

export interface MvpBillingSource {
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

export interface MvpBillingStatement {
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

export interface MvpPaymentRecord {
  id: string;
  eventId: string;
  milestoneId: string;
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  recordedAt: string;
}

export interface MvpPaymentMilestone {
  id: string;
  eventId: string;
  label: string;
  percentage: number;
  amount: number;
  amountPaid: number;
  remainingBalance: number;
  dueDate: string;
  status: string;
  history: MvpPaymentRecord[];
}

export interface MvpPostEventDocument {
  id: string;
  eventId: string;
  title: string;
  status: string;
}

export interface MvpCloseGate {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface MvpCloseGates {
  eventId: string;
  ready: boolean;
  gates: MvpCloseGate[];
  missingKeys: string[];
}

export interface MvpEventInsight {
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

export interface MvpAuditLog {
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

export interface MvpLoginHistory {
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

export interface MvpSecurityAlert {
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

export interface MvpAuditIntegrity {
  valid: boolean;
  checkedCount: number;
  firstBrokenLogId?: string | null;
  lastVerifiedHash?: string | null;
  checkedAt: string;
}

export interface MvpPrivacyInventorySurface {
  surface: string;
  recordCount: number;
  dataCategories: string[];
  consentAcceptedCount: number;
  missingConsentCount: number;
  privacyNoticeVersions: string[];
}

export interface MvpPrivacyInventoryEvent {
  eventId: string;
  eventName: string;
  dataCategories: string[];
  recordCount: number;
  surfaces: MvpPrivacyInventorySurface[];
  retentionNotes: string;
}

export interface MvpPrivacyInventory {
  generatedAt: string;
  events: MvpPrivacyInventoryEvent[];
  globalSurfaces: MvpPrivacyInventorySurface[];
  retentionNotes: string[];
}

export interface MvpPrivacyRetentionPolicy {
  surface: string;
  dataCategories: string[];
  retentionPeriod: string;
  deletionBehavior: string;
}

export interface MvpPrivacyRequest {
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

export interface MvpAuditExport {
  exportedAt: string;
  recordCount: number;
  rows: MvpAuditLog[];
}

export interface MvpNotificationLog {
  id: string;
  eventId?: string;
  channel: "email" | "viber";
  recipient: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface MvpApprovalRequest {
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

export interface MvpDemoState {
  users: MvpUser[];
  inquiries: MvpInquiry[];
  events: MvpEvent[];
  documents: MvpDocument[];
  briefings: MvpBriefing[];
  supplierQuoteRequests: MvpSupplierQuoteRequest[];
  supplierQuotes: MvpSupplierQuote[];
  coordinators: MvpCoordinator[];
  coordinatorRoleRequirements: MvpCoordinatorRoleRequirement[];
  coordinatorAssignments: MvpCoordinatorAssignment[];
  complianceRules: MvpComplianceRule[];
  complianceChecks: MvpComplianceCheck[];
  billingSources: MvpBillingSource[];
  billingStatements: MvpBillingStatement[];
  paymentMilestones: MvpPaymentMilestone[];
  paymentRecords: MvpPaymentRecord[];
  postEventDocuments: MvpPostEventDocument[];
  eventInsights: MvpEventInsight[];
  floorPlanDrafts: MvpFloorPlanDraft[];
  supplierCategories: MvpSupplierCategory[];
  suppliers: MvpSupplier[];
  auditLogs: MvpAuditLog[];
  notificationLogs: MvpNotificationLog[];
}

type CreateFloorPlanDraftInput = {
  name: string;
  sourceType: "blank" | "template" | "client_preference";
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  objects?: MvpProjectLike["objects"];
  guests?: MvpProjectLike["guests"];
  suppliers?: MvpProjectLike["suppliers"];
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

