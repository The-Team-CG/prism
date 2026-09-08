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
  sessionVersion?: number;
  clientName?: string;
  supplierId?: string;
  coordinatorId?: string;
  eventId?: string;
  accessCode?: string;
}

export const PRISM_DEFAULT_PAGE_LIMIT = 25;
export const PRISM_MAX_PAGE_LIMIT = 100;

export interface PrismCursorPageRequest {
  cursor?: string;
  limit?: number;
}

export interface PrismPageRequest extends PrismCursorPageRequest {
  page?: number;
}

export interface PrismCursorPage<TItem> {
  items: TItem[];
  page?: number;
  limit: number;
  total?: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export function normalizePrismPageLimit(limit: unknown): number {
  const numericLimit = typeof limit === "number" ? limit : typeof limit === "string" ? Number(limit) : NaN;
  if (!Number.isFinite(numericLimit) || numericLimit < 1) return PRISM_DEFAULT_PAGE_LIMIT;
  return Math.min(Math.trunc(numericLimit), PRISM_MAX_PAGE_LIMIT);
}

export type PrismSortDirection = "asc" | "desc";

export interface PrismSortClause<TField extends string = string> {
  field: TField;
  direction: PrismSortDirection;
}

export type PrismFilterOperator = "equals" | "not_equals" | "contains" | "in" | "before" | "after" | "between";

export interface PrismFilterClause<TField extends string = string> {
  field: TField;
  operator: PrismFilterOperator;
  value: string | number | boolean | Array<string | number | boolean>;
}

export interface PrismListQuery<TField extends string = string> extends PrismPageRequest {
  filters?: PrismFilterClause<TField>[];
  sort?: PrismSortClause<TField>[];
}

export interface PrismFieldError {
  field: string;
  message: string;
  code?: string;
}

export type PrismEmptyReason =
  | "no_data"
  | "not_ready"
  | "permission_denied"
  | "not_configured"
  | "blocked_by_gate"
  | "filtered_out";

export interface PrismApiProblem {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  emptyReason?: PrismEmptyReason;
  fieldErrors?: PrismFieldError[];
  auditReference?: string;
}

export type PrismActionResultStatus = "success" | "partial_success" | "denied" | "retryable_failure" | "failed";

export interface PrismActionResult<TData = unknown> {
  status: PrismActionResultStatus;
  message: string;
  data?: TData;
  problem?: PrismApiProblem;
  auditReference?: string;
  notificationReference?: string;
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
  sessionVersion?: number;
}

export interface PrismAuthenticatedSession extends PrismUser {
  accessToken: string;
  expiresAt: string;
  signedInAt: string;
  tokenType?: "Bearer";
}
export interface PrismTwoFactorSetupRequired {
  kind: 'two_factor_setup_required';
  token: string;
}

export interface PrismTwoFactorRequired {
  kind: 'two_factor_required';
  token: string;
}

export interface PrismTwoFactorSetup {
  kind: 'two_factor_setup';
  token: string;
  secret: string;
  otpauthUri: string;
}

export type PrismAuthResponse =
  | PrismAuthenticatedSession
  | PrismTwoFactorSetupRequired
  | PrismTwoFactorRequired;


export interface PrismVerifiedEventActor extends PrismEventOpsActorContext {
  id: string;
  actorId: string;
  role: PrismEventOpsActorRole;
  actorRole: PrismEventOpsActorRole;
  email: string;
  actorEmail: string;
  name: string;
  actorName: string;
  expiresAt: string;
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
  channel?: string | null;
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
  walkInPolicy?: "closed" | "open" | "threshold";
  walkInThreshold?: number;
  actualEndedAt?: string | null;
  actualEndedBy?: string | null;
  status: string;
  clientPortalStatus: "locked" | "unlocked";
  readiness: string;
  archived: boolean;
  floorPlanStatus: string;
  floorPlanId?: string | null;
  guestAccessCode?: string;
  proposalClientStatus?: "pending" | "approved" | "revision_requested";
  proposalRevisionCount?: number;
  proposalReviewedAt?: string | null;
  proposalReviewedBy?: string | null;
  activeFloorPlanDraftId?: string;
  floorPlanDrafts?: PrismFloorPlanDraft[];
}

export interface PrismArchivedEventSearchHit {
  id: string;
  eventName: string;
  clientName: string;
  eventDate: string;
  venue: string;
  eventType: string;
  archivedAt: string | null;
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

export interface PrismSupplierReviewDimension {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface PrismSupplierCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
  reviewDimensions: PrismSupplierReviewDimension[];
}

export interface PrismSupplierPastEvent {
  id: string;
  eventName: string;
  clientName: string;
  eventDate: string;
}

export interface PrismSupplierReviewDimensionRating {
  dimensionId: string;
  dimensionName: string;
  rating: number;
}

export interface PrismSupplierReview {
  id: string;
  rating: number;
  notes: string;
  reviewedBy: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
  dimensionRatings: PrismSupplierReviewDimensionRating[];
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

export type PrismSupplierApplicationStatus =
  | "pending"
  | "under_review"
  | "proposal_requested"
  | "meeting_scheduled"
  | "approved"
  | "declined";

export interface PrismSupplierApplication {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  categoryId: string | null;
  categoryName: string | null;
  pastEvents: string;
  serviceInclusions: string;
  certifications: string;
  priceRange: string;
  bniMember: boolean;
  portfolioUrl: string;
  additionalNotes: string;
  status: PrismSupplierApplicationStatus;
  declineReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface PrismCommunicationParticipant { id: string; actorId: string; actorRole: string; active: boolean; lastReadAt?: string | null; }
export interface PrismCommunicationParticipantChoice { id: string; name: string; email: string; role: string; }
export interface PrismCommunicationMessage { id: string; threadId: string; senderId: string; senderRole: string; body: string; createdAt: string; }
export interface PrismCommunicationThread { id: string; eventId: string; subject: string; status: string; createdBy: string; createdAt: string; updatedAt: string; participants: PrismCommunicationParticipant[]; messages: PrismCommunicationMessage[]; messagesNextCursor?: string | null; unreadCount?: number; }

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
  acknowledgedBy?: string | null;
  acknowledgementReason?: string;
  withdrawalReason?: string;
  withdrawnAt?: string | null;
  withdrawnBy?: string | null;
  acknowledgementHistory?: PrismCoordinatorAssignmentAcknowledgment[];
  createdAt?: string;
}

export interface PrismCoordinatorAssignmentAcknowledgment {
  id: string;
  assignmentId: string;
  state: "acknowledged" | "declined" | string;
  reason: string;
  actor: string;
  createdAt: string;
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

export interface PrismCoordinatorAvailability {
  id: string;
  coordinatorId: string;
  startsAt: string;
  endsAt: string;
  kind: "unavailable" | "blocked" | string;
  note: string;
  declaredBy: string;
  createdAt: string;
}

export interface PrismCoordinatorCoverage {
  role: string;
  required: number;
  assigned: number;
  acknowledged: number;
  requiredSkills: string[];
  assignedSkills: string[];
  satisfied: boolean;
}

export interface PrismGuestCheckIn {
  id: string;
  eventId: string;
  rosterEntryId?: string | null;
  guestName: string;
  checkInMode: string;
  status: string;
  walkIn: boolean;
  verificationStatus: string;
  checkedInAt: string;
}

export interface PrismGuestRosterEntry {
  id: string;
  eventId: string;
  sourceKey: string;
  guestName: string;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  table?: string | null;
  eligibility: string;
  verificationStatus: "pending" | "verified" | "rejected";
  source: string;
  importBatchId?: string | null;
  checkedInAt?: string | null;
  withdrawnAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrismGuestEventPass {
  id: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  readiness: string;
  floorPlanStatus: string;
  activeFloorPlanDraftId?: string;
  guestAccessCode: string;
  attendanceCount: number;
}

export interface PrismGuestFeedback {
  id: string;
  eventId: string;
  guestName: string;
  rating: number;
  comment: string;
  photoFileName: string | null;
  videoFileName: string | null;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
  moderationStatus: string;
  moderationReason: string | null;
  moderatedById: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  privacyConsentWithdrawnAt: string | null;
  marketingConsentWithdrawnAt: string | null;
  mediaAttachments: PrismGuestFeedbackMedia[];
  submittedAt: string;
}

export interface PrismGuestFeedbackMedia {
  id: string;
  kind: "photo" | "video";
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending_storage";
  blocker: string;
}

export type PrismRegistrationPlatformType = "xperto" | "clickpass" | "custom" | "none";

export type PrismRegistrationPlatformStatus = "not_started" | "configuring" | "live" | "closed";

export interface PrismRegistrationPlatform {
  id: string;
  eventId: string;
  platformType: PrismRegistrationPlatformType;
  supplierId: string | null;
  expectedPaxMin: number;
  expectedPaxMax: number;
  status: PrismRegistrationPlatformStatus;
  setupConfirmedAt: string | null;
  setupNotes: string;
  headcountSource: string;
  importedHeadcount: number;
  importedAt: string | null;
  importedFileName: string | null;
  createdAt: string;
  updatedAt: string;
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

export type PrismEventTaskReassignmentStatus = "pending" | "approved" | "rejected" | "auto_approved" | string;

export interface PrismEventTaskReassignmentRequest {
  id: string;
  eventId: string;
  taskId: string;
  requestedBy: string;
  requestedByRole: string;
  fromOwnerRole: string;
  fromOwnerName: string;
  toOwnerRole: string;
  toOwnerName: string;
  reason: string;
  status: PrismEventTaskReassignmentStatus;
  requestedAt: string;
  autoApproveAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionReason?: string | null;
}

export interface PrismUrgentIssue {
  id: string;
  eventId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "assigned" | "resolved" | "cancelled" | string;
  affectedArea: string;
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
  briefing?: PrismBriefing | null;
  role?: string;
  tasks: PrismEventDayTask[];
  urgentIssues: PrismUrgentIssue[];
  supplierStatuses: PrismSupplierQuoteRequest[];
  coordinatorAssignments: PrismCoordinatorAssignment[];
  guestAttendanceCount: number;
  guestCheckIns: PrismGuestCheckIn[];
  eventDayLogs: PrismEventDayLog[];
  schedule?: PrismEventSchedule;
  timer?: PrismLiveOpsTimer;
  isDesignatedOperator?: boolean;
  canMarkDelegatedAttendance?: boolean;
  taskReassignmentRequests?: PrismEventTaskReassignmentRequest[];
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

export type PrismScheduleDayStatus = "planned" | "active" | "complete" | string;
export type PrismScheduleSegmentStatus = "planned" | "active" | "complete" | "skipped" | string;

export interface PrismEventScheduleSegment {
  id: string;
  dayId: string;
  sequence: number;
  title: string;
  plannedStartAt: string;
  plannedEndAt: string;
  ownerRole: string;
  location: string;
  status: PrismScheduleSegmentStatus;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  startVarianceMinutes: number | null;
  endVarianceMinutes: number | null;
}

export interface PrismEventScheduleDay {
  id: string;
  eventId: string;
  dayDate: string;
  label: string;
  status: PrismScheduleDayStatus;
  segments: PrismEventScheduleSegment[];
}

export interface PrismEventSchedule {
  eventId: string;
  authored: boolean;
  days: PrismEventScheduleDay[];
  serverTime: string;
}

export interface PrismEventRunSheet {
  eventId: string;
  day: PrismEventScheduleDay;
  coordinators: PrismCoordinatorAssignment[];
  supplierCommitments: Array<{ id: string; supplierName: string; category: string; status: string; notes: string }>;
  openTasks: PrismEventDayTask[];
  openIssues: PrismUrgentIssue[];
}

export interface PrismEventHandoff {
  id: string;
  eventId: string;
  dayId: string;
  role: string;
  fromAssignmentId: string;
  toAssignmentId: string;
  handedOffBy: string;
  receivedBy: string;
  handedOffAt: string;
  outstandingItems: string[];
}

export interface PrismEventEodReply {
  id: string;
  reportId: string;
  authorId: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface PrismEventEodReport {
  id: string;
  eventId: string;
  dayId: string;
  authoredBy: string;
  authoredByRole: string;
  progress: string[];
  issues: string[];
  risksForTomorrow: string[];
  submittedAt: string;
  replies: PrismEventEodReply[];
}

export interface PrismLiveOpsTimer {
  status: "no_schedule" | "before_start" | "active" | "between_segments" | "complete";
  label: string;
  segmentId?: string;
  secondsRemaining?: number;
  secondsElapsed?: number;
  serverTime: string;
}

export interface PrismCoordinatorWorkspace {
  coordinator: PrismCoordinator;
  assignments: PrismCoordinatorAssignment[];
  events: PrismEvent[];
}

export type PrismCoordinatorSupplierStatus = Pick<
  PrismSupplierQuoteRequest,
  | "id"
  | "eventId"
  | "supplierId"
  | "supplierName"
  | "category"
  | "assignmentStatus"
  | "readinessStatus"
  | "eventDayStatus"
  | "eventDayNotes"
  | "verificationStatus"
  | "verifiedAt"
  | "verifiedBy"
>;

export interface PrismCoordinatorLiveOps extends Omit<PrismLiveOps, "supplierStatuses" | "role"> {
  role: string;
  supplierStatuses: PrismCoordinatorSupplierStatus[];
}

export interface PrismCoordinatorRoleView extends Omit<PrismCoordinatorLiveOps, "eventDayLogs"> {
  assignment: PrismCoordinatorAssignment;
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

export type PrismCommandInboxSeverity = "critical" | "warning" | "attention" | "info";

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
  postEventDocuments: PrismPostEventDocument[];
  eventInsights: PrismEventInsight[];
  floorPlanDrafts: PrismFloorPlanDraft[];
  auditLogs: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
  registrationPlatform: PrismRegistrationPlatform | null;
}

export interface PrismClientActionItem {
  id: string;
  kind: Extract<PrismCommandInboxKind, "briefing" | "billing" | "document" | "floorplan" | "approval" | "closure" | "feedback">;
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

// PARE types

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

