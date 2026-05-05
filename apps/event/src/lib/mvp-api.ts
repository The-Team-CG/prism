import type { Project } from "@/app/components/editor/types";

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
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
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
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
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

interface ApiFloorPlan {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
  updatedAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

export function apiUrl(path: string) {
  if (!path) return "#";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw err;
  }

  const text = await response.text();
  let payload: { data?: T; message?: string } | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as { data?: T; message?: string };
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  return payload?.data as T;
}

function apiPlanToProject(plan: ApiFloorPlan): Project {
  const updatedAt = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    objects: Array.isArray(plan.objects) ? plan.objects : [],
    guests: Array.isArray(plan.guests) ? plan.guests : [],
    suppliers: Array.isArray(plan.suppliers) ? plan.suppliers : [],
    createdAt: updatedAt,
    updatedAt,
  };
}

const pmcmActorQuery = new URLSearchParams({
  actorRole: "pmcm-admin",
  actorName: "Ms. Mys",
  actorEmail: "mys@pmcm.test",
}).toString();

function withPmcmActor(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${pmcmActorQuery}`;
}

function coordinatorActorQuery(session: { name: string; email: string; role: string }) {
  return new URLSearchParams({
    actorRole: "coordinator",
    actorName: session.name,
    actorEmail: session.email,
  }).toString();
}

function withCoordinatorActor(path: string, session: { name: string; email: string; role: string }) {
  return `${path}${path.includes("?") ? "&" : "?"}${coordinatorActorQuery(session)}`;
}

export const mvpApi = {
  state: () => request<MvpDemoState>("/api/demo/state"),
  pmcmState: async () => {
    const [state, onboarding, events, suppliers, billing] = await Promise.all([
      request<MvpDemoState>("/api/demo/state"),
      request<{ inquiries: MvpInquiry[]; documents: MvpDocument[] }>(`/api/onboarding?${pmcmActorQuery}`),
      request<MvpEvent[]>(`/api/events?${pmcmActorQuery}`),
      request<MvpSupplier[]>(`/api/suppliers?${pmcmActorQuery}`),
      request<{
        billingSources: MvpBillingSource[];
        billingStatements: MvpBillingStatement[];
        paymentMilestones: MvpPaymentMilestone[];
        paymentRecords?: MvpPaymentRecord[];
      }>(`/api/billing?${pmcmActorQuery}`),
    ]);

    return {
      ...state,
      inquiries: onboarding.inquiries,
      events,
      documents: onboarding.documents,
      suppliers,
      billingSources: billing.billingSources ?? state.billingSources,
      billingStatements: billing.billingStatements,
      paymentMilestones: billing.paymentMilestones,
      paymentRecords: billing.paymentRecords ?? state.paymentRecords,
    };
  },
  reset: () => request<MvpDemoState>("/api/demo/reset", { method: "POST" }),
  login: (input: { email: string; password: string }) =>
    request<MvpUser & { signedInAt: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  approvalRequests: () => request<MvpApprovalRequest[]>("/api/auth/approval-requests"),
  loginHistory: (userId: string) => request<MvpLoginHistory[]>(`/api/auth/users/${userId}/login-history`),
  auditLogs: (filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    const query = params.toString();
    return request<MvpAuditLog[]>(`/api/audit/logs${query ? `?${query}` : ""}`);
  },
  exportAuditLogs: (filters: AuditLogFilters = {}) =>
    request<MvpAuditExport>("/api/audit/export", {
      method: "POST",
      body: JSON.stringify(filters),
    }),
  securityAlerts: () => request<MvpSecurityAlert[]>("/api/audit/alerts"),
  auditIntegrity: () => request<MvpAuditIntegrity>(withPmcmActor("/api/audit/integrity")),
  privacyInventory: (eventId?: string) =>
    request<MvpPrivacyInventory>(withPmcmActor(`/api/privacy/inventory${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`)),
  privacyRetentionPolicies: () => request<MvpPrivacyRetentionPolicy[]>(withPmcmActor("/api/privacy/retention-policies")),
  privacyRequests: (eventId?: string) =>
    request<MvpPrivacyRequest[]>(withPmcmActor(`/api/privacy/requests${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`)),
  createPrivacyRequest: (input: CreatePrivacyRequestInput) =>
    request<MvpPrivacyRequest>(withPmcmActor("/api/privacy/requests"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reviewPrivacyRequest: (requestId: string, input: ReviewPrivacyRequestInput) =>
    request<MvpPrivacyRequest>(withPmcmActor(`/api/privacy/requests/${requestId}/review`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  executePrivacyRequest: (requestId: string, executionNotes?: string) =>
    request<MvpPrivacyRequest>(withPmcmActor(`/api/privacy/requests/${requestId}/execute`), {
      method: "POST",
      body: JSON.stringify({ executionNotes }),
    }),
  approveApprovalRequest: (requestId: string) =>
    request<MvpApprovalRequest>(`/api/auth/approval-requests/${requestId}/approve`, { method: "PATCH" }),
  declineApprovalRequest: (requestId: string) =>
    request<MvpApprovalRequest>(`/api/auth/approval-requests/${requestId}/decline`, { method: "PATCH" }),
  acceptInquiry: (inquiryId: string) =>
    request<MvpInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "accepted" }),
    }),
  pendInquiry: (inquiryId: string) =>
    request<MvpInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "pending" }),
    }),
  logInquiryOnBehalf: (input: {
    clientName: string;
    companyName?: string;
    email: string;
    eventName: string;
    eventType?: string;
    eventDate: string;
    clientType: string;
    referralDetails?: string;
    message: string;
  }) =>
    request<MvpInquiry>("/api/inquiries/log-on-behalf?actorRole=pmcm-admin&actorName=Ms.%20Mys&actorEmail=mys%40pmcm.test", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  declineInquiry: (inquiryId: string, declineReason: string) =>
    request<MvpInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "declined", declineReason }),
    }),
  sendConformeReminder: (inquiryId: string) =>
    request<MvpInquiry>(`/api/inquiries/${inquiryId}/conforme-reminders`, { method: "POST" }),
  uploadConforme: (inquiryId: string) =>
    request<MvpDocument>(`/api/inquiries/${inquiryId}/conforme`, {
      method: "POST",
      body: JSON.stringify({ type: "signed_conforme", fileName: "signed-conforme.pdf" }),
    }),
  createFloorPlanDraft: (eventId: string, input: CreateFloorPlanDraftInput) =>
    request<MvpFloorPlanDraft>(withPmcmActor(`/api/events/${eventId}/floorplans`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submitFloorPlanDraft: (eventId: string, draftId: string) =>
    request<MvpFloorPlanDraft>(withPmcmActor(`/api/events/${eventId}/floorplans/${draftId}/submit`), { method: "POST" }),
  approveFloorPlanDraft: (eventId: string, draftId: string) =>
    request<MvpFloorPlanDraft>(withPmcmActor(`/api/events/${eventId}/floorplans/${draftId}/approve`), { method: "POST" }),
  loadFloorPlanSnapshot: (eventId: string, draftId: string, type: "submitted" | "approved" = "approved") =>
    request<ApiFloorPlan>(withPmcmActor(`/api/events/${eventId}/floorplans/${draftId}/snapshot?type=${type}`)).then((plan) =>
      apiPlanToProject(plan),
    ),
  loadPlan: (planId: string) =>
    request<ApiFloorPlan>(withPmcmActor(`/api/plans/${planId}`)).then((plan) => apiPlanToProject(plan)),
  savePlan: (project: Project) =>
    request<ApiFloorPlan>(withPmcmActor(`/api/plans/${project.id}`), {
      method: "PUT",
      body: JSON.stringify({
        venue: project.venue,
        width: Math.max(1, Math.round(project.widthM)),
        height: Math.max(1, Math.round(project.heightM)),
        gridSize: 1,
        pax: Math.max(0, Math.round(project.pax)),
        objects: project.objects,
        guests: project.guests,
        suppliers: project.suppliers,
        seats: [],
        seatCategories: [],
      }),
    }).then((plan) => apiPlanToProject(plan)),
  submitBriefing: (eventId: string) =>
    request<MvpBriefing>(`/api/events/${eventId}/briefing`, {
      method: "POST",
      body: JSON.stringify({
        venue: "Shangri-La Grand Ballroom",
        guestCount: 240,
        budgetRange: "PHP 450,000 - 520,000",
        serviceRequirements: ["Digital Registration", "Stage and Technicals", "Documentation"],
        notes: "Client prefers a polished technology summit setup with clear ingress flow.",
      }),
    }),
  addSupplierQuote: (eventId: string, input: AddSupplierQuoteInput = {}) =>
    request<MvpSupplierQuote>(`/api/events/${eventId}/supplier-quotes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestSupplierQuotes: (eventId: string, input: RequestSupplierQuotesInput) =>
    request<MvpSupplierQuoteRequest[]>(`/api/events/${eventId}/quote-requests`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  selectSupplierQuote: (eventId: string, quoteId: string) =>
    request<MvpSupplierQuote>(`/api/events/${eventId}/supplier-quotes/${quoteId}/select`, { method: "PATCH" }),
  createSupplier: (input: CreateSupplierInput) =>
    request<MvpSupplier>(withPmcmActor("/api/suppliers"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSupplier: (supplierId: string, input: UpdateSupplierInput) =>
    request<MvpSupplier>(withPmcmActor(`/api/suppliers/${supplierId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  changeSupplierTier: (supplierId: string, input: ChangeSupplierTierInput) =>
    request<MvpSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/tier`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  addSupplierReview: (supplierId: string, input: CreateSupplierReviewInput) =>
    request<MvpSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/reviews`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  addSupplierCertification: (supplierId: string, input: CreateSupplierCertificationInput) =>
    request<MvpSupplier>(withPmcmActor(`/api/suppliers/${supplierId}/certifications`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  coordinators: () => request<MvpCoordinator[]>("/api/coordinators"),
  complianceRules: () => request<MvpComplianceRule[]>(withPmcmActor("/api/compliance/rules")),
  createComplianceRule: (input: CreateComplianceRuleInput) =>
    request<MvpComplianceRule>(withPmcmActor("/api/compliance/rules"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateComplianceRule: (ruleId: string, input: Partial<CreateComplianceRuleInput>) =>
    request<MvpComplianceRule>(withPmcmActor(`/api/compliance/rules/${ruleId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  runCompliance: (eventId: string, phase = "planning") =>
    request<MvpComplianceCheck[]>(`/api/events/${eventId}/compliance`, {
      method: "POST",
      body: JSON.stringify({ phase }),
    }),
  resolveCompliance: (eventId: string, checkId: string, input: ResolveComplianceInput = { note: "Resolved during PMCM review." }) =>
    request<MvpComplianceCheck>(`/api/events/${eventId}/compliance/${checkId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  assignCoordinator: (eventId: string, input: AssignCoordinatorInput) =>
    request<MvpCoordinatorAssignment>(`/api/events/${eventId}/coordinators`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  acknowledgeCoordinator: (eventId: string, assignmentId: string) =>
    request<MvpCoordinatorAssignment>(`/api/events/${eventId}/coordinators/${assignmentId}/acknowledge`, {
      method: "PATCH",
    }),
  defenseReadiness: (eventId: string) => request<MvpDefenseReadiness>(withPmcmActor(`/api/events/${eventId}/defense-readiness`)),
  liveOps: (eventId: string) => request<MvpLiveOps>(withPmcmActor(`/api/events/${eventId}/live-ops`)),
  eventDayStatusFeed: (eventId: string) =>
    request<MvpEventDayStatusFeed>(withPmcmActor(`/api/events/${eventId}/event-day/status-feed`)),
  createEventDayTask: (eventId: string, input: CreateEventDayTaskInput) =>
    request<MvpEventDayTask>(withPmcmActor(`/api/events/${eventId}/event-day/tasks`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateEventDayTask: (eventId: string, taskId: string, input: UpdateEventDayTaskInput) =>
    request<MvpEventDayTask>(withPmcmActor(`/api/events/${eventId}/event-day/tasks/${taskId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  escalateEventDayTask: (eventId: string, taskId: string, input: EscalateLiveOpsInput) =>
    request<MvpEventDayTask>(withPmcmActor(`/api/events/${eventId}/event-day/tasks/${taskId}/escalate`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createUrgentIssue: (eventId: string, input: CreateUrgentIssueInput) =>
    request<MvpUrgentIssue>(withPmcmActor(`/api/events/${eventId}/urgent-issues`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateUrgentIssue: (eventId: string, issueId: string, input: UpdateUrgentIssueInput) =>
    request<MvpUrgentIssue>(withPmcmActor(`/api/events/${eventId}/urgent-issues/${issueId}`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  escalateUrgentIssue: (eventId: string, issueId: string, input: EscalateLiveOpsInput) =>
    request<MvpUrgentIssue>(withPmcmActor(`/api/events/${eventId}/urgent-issues/${issueId}/escalate`), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCoordinatorAttendance: (eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) =>
    request<MvpCoordinatorAssignment>(withPmcmActor(`/api/events/${eventId}/coordinators/${assignmentId}/status`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  replaceCoordinator: (eventId: string, assignmentId: string, input: ReplaceCoordinatorInput) =>
    request<{ replacedAssignment: MvpCoordinatorAssignment; replacementAssignment: MvpCoordinatorAssignment }>(
      withPmcmActor(`/api/events/${eventId}/coordinators/${assignmentId}/replace`),
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  verifySupplierStatus: (eventId: string, requestId: string, input: VerifySupplierStatusInput) =>
    request<MvpSupplierQuoteRequest>(withPmcmActor(`/api/events/${eventId}/supplier-status/${requestId}/verify`), {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  coordinatorWorkspace: (session: { name: string; email: string; role: string }) =>
    request<MvpCoordinatorWorkspace>(withCoordinatorActor("/api/coordinator/workspace", session)),
  coordinatorRoleView: (session: { name: string; email: string; role: string }, eventId: string) =>
    request<MvpCoordinatorRoleView>(withCoordinatorActor(`/api/coordinator/events/${eventId}/role-view`, session)),
  markPayment: (eventId: string, milestoneId: string, status: "pending" | "paid" | "at_risk" = "paid") =>
    request<MvpPaymentMilestone>(`/api/events/${eventId}/payments/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  recordPayment: (eventId: string, milestoneId: string, input: RecordPaymentInput) =>
    request<MvpPaymentMilestone>(`/api/events/${eventId}/payments/${milestoneId}/records`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createBillingSource: (eventId: string, input: CreateBillingSourceInput) =>
    request<MvpBillingSource>(`/api/events/${eventId}/billing-source`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  approveBillingSource: (eventId: string, sourceId: string, approvalNotes?: string) =>
    request<MvpBillingSource>(`/api/events/${eventId}/billing-source/${sourceId}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approvedBy: "Ms. Mys", approvalNotes }),
    }),
  generateBillingStatement: (eventId: string, sourceId?: string) =>
    request<MvpBillingStatement>(`/api/events/${eventId}/billing-statements/generate`, {
      method: "POST",
      body: JSON.stringify({ sourceId }),
    }),
  sendBillingStatement: (eventId: string, billingId: string) =>
    request<MvpBillingStatement>(`/api/events/${eventId}/billing-statements/${billingId}/send`, { method: "POST" }),
  closeGates: (eventId: string) => request<MvpCloseGates>(`/api/events/${eventId}/close-gates`),
  archiveEvent: (eventId: string, overrideReason?: string) =>
    request<MvpEvent>(`/api/events/${eventId}/archive`, {
      method: "POST",
      body: JSON.stringify({ overrideReason, actorName: "Ms. Mys" }),
    }),
  eventInsights: (eventId: string) => request<MvpEventInsight[]>(withPmcmActor(`/api/events/${eventId}/insights`)),
  generateEventInsights: (eventId: string) =>
    request<MvpEventInsight>(`/api/events/${eventId}/insights/generate`, { method: "POST" }),
};
