import type { PrismBriefing, PrismEvent } from "./lifecycle.js";
import type { PrismSupplierQuoteRequest } from "./commercial.js";
import type { GuestPrivacyClassification } from "../schemas/operations-guest-inputs.js";
import type { CommunicationThreadStatus } from "../schemas/commercial-inputs.js";

export type { GuestCheckInReceipt as PrismGuestCheckInReceipt } from "../schemas/operations-guest-inputs.js";

export interface PrismCommunicationParticipant {
  id: string;
  actorId: string;
  actorRole: string;
  /** The account's display name. People in one conversation see each other's names, never emails. */
  name?: string;
  active: boolean;
  /** Own read time, or other members' times only in a PMCM response. */
  lastReadAt?: string | null;
}

/** PMCM-only projection for the active members of one conversation. */
export interface PrismCommunicationReadReceipt {
  actorId: string;
  name?: string;
  lastReadAt: string | null;
}

export interface PrismCommunicationParticipantChoice {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface PrismCommunicationMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: string;
  /** Kept on the message so a sender who has left the conversation still has a name. */
  senderName?: string;
  body: string;
  createdAt: string;
}

export interface PrismCommunicationThread {
  id: string;
  eventId: string;
  subject: string;
  /** Closed by PMCM; a closed conversation takes no new messages until reopened. */
  status: CommunicationThreadStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  participants: PrismCommunicationParticipant[];
  messages: PrismCommunicationMessage[];
  messagesNextCursor?: string | null;
  unreadCount?: number;
}

/** One row of the cross-event inbox: the conversation and its latest message, without its history. */
export interface PrismCommunicationInboxThread extends Omit<PrismCommunicationThread, "messages" | "messagesNextCursor"> {
  eventName: string;
  lastMessage: PrismCommunicationMessage | null;
  unreadCount: number;
}

/** Unread messages across the conversations the signed-in account can see in its inbox. */
export interface PrismCommunicationUnreadCount {
  unread: number;
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
  acknowledgedBy?: string | null;
  acknowledgementReason?: string;
  withdrawalReason?: string;
  withdrawnAt?: string | null;
  withdrawnBy?: string | null;
  /** True when the coordinator withdrew inside the 48-hour emergency window before the event day. */
  emergencyChange?: boolean;
  acknowledgementHistory?: PrismCoordinatorAssignmentAcknowledgment[];
  createdAt?: string;
}

export interface PrismCoordinatorSuggestion {
  id: string;
  name: string;
  role: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchedSkillCount: number;
  requiredSkillCount: number;
}
/** Who is free to be staffed on an event's date, counted across the whole active coordinator pool. */
export interface PrismCoordinatorPoolAvailability {
  eventDate: string;
  activeCoordinators: number;
  available: number;
  alreadyAssigned: number;
  markedUnavailable: number;
  /** Available coordinators per catalog role; a coordinator holding several role tags counts under each. */
  availableByRole: Array<{ role: string; available: number }>;
}

export interface PrismCoordinatorAssignmentAcknowledgment {
  id: string;
  assignmentId: string;
  state: "acknowledged" | "declined" | string;
  reason: string;
  actor: string;
  createdAt: string;
}

/** Result from the Operations attendance command; `changed` suppresses duplicate LiveOps log intent. */
export interface PrismCoordinatorAttendanceUpdateResult {
  assignment: PrismCoordinatorAssignment;
  changed: boolean;
}

export interface PrismCoordinatorReliabilityHistoryEntry {
  id: string;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  assignmentId: string | null;
  assignmentRole: string | null;
  note: string;
  severity: string;
  createdAt: string;
}

/** Aggregated staffing evidence used in a PMCM event insights card. */
export interface PrismCoordinatorInsightFacts {
  assignments: number;
  awaitingAcknowledgement: number;
  lateAttendance: number;
  absentAttendance: number;
  replacedAssignments: number;
  cancelledAssignments: number;
  reliabilityNotes: number;
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

export interface PrismAcknowledgementReminderResult {
  leadTimeDays: number;
  reminders: Array<{
    assignmentId: string;
    status: string;
    reason: string | null;
  }>;
}

/** The coordinator PMCM has designated as Event Day System Operator, if any. */
export interface PrismEventOperatorDesignation {
  eventId: string;
  operator: {
    coordinatorId: string;
    coordinatorName: string | null;
    designatedAt: string;
  } | null;
}

export interface PrismGuestPrivacyClassification {
  eventId: string;
  classification: GuestPrivacyClassification;
}

export interface PrismGuestCheckIn {
  id: string;
  eventId: string;
  rosterEntryId?: string | null;
  guestName: string | null;
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
  verificationFlaggedAt?: string | null;
  verificationFlaggedBy?: string | null;
  importBatchId?: string | null;
  checkedInAt?: string | null;
  withdrawnAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Minimal guest details exposed to assigned registration coordinators. */
export interface PrismCoordinatorRegistrationEntry {
  id: string;
  eventId: string;
  guestName: string;
  category?: string | null;
  table?: string | null;
  eligibility: string;
  verificationStatus: "pending" | "verified" | "rejected";
  checkedInAt?: string | null;
  walkIn: boolean;
  reviewSubmittedAt?: string | null;
  /** Set when registration staff flag an unauthorized walk-in; cleared when it is verified. */
  verificationFlaggedAt?: string | null;
  verificationFlaggedBy?: string | null;
}

export type PrismGuestFeedbackAvailability = "not_open" | "open" | "closed";

export interface PrismGuestEventPass {
  id: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  readiness: string;
  floorPlanStatus: string;
  activeFloorPlanDraftId?: string;
  guestAccessCode: string;
  watermark: string;
  feedbackAvailability: PrismGuestFeedbackAvailability;
  /** Venue from the event's latest briefing; omitted when none is recorded. */
  venue?: string;
  /** Confirmed start time (HH:mm, Philippine time) from the latest briefing; omitted when not confirmed. */
  startTime?: string;
}

export interface PrismGuestEventWatermark {
  watermark: string;
  feedbackAvailability: PrismGuestFeedbackAvailability;
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

/** Minimal acknowledgement returned to a guest after submitting or withdrawing feedback consent. */
export interface PrismGuestFeedbackReceipt {
  id: string;
  eventId: string;
  submittedAt: string;
}

export interface PrismGuestFeedbackMedia {
  id: string;
  kind: "photo" | "video";
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  blocker: string;
  /** The byte-checked stored file; null on media recorded before guest uploads were stored. */
  storedObjectId: string | null;
}

/** New-SEC3: a guest feedback photo or video stored after its bytes passed the file checks. */
export interface PrismGuestFeedbackMediaUpload {
  objectId: string;
  kind: "photo" | "video";
}

export type PrismRegistrationPlatformType =
  | "xperto"
  | "clickpass"
  | "custom"
  | "none";

export type PrismRegistrationPlatformStatus =
  | "not_started"
  | "configuring"
  | "live"
  | "closed";

export type PrismRegistrationPlatformSetupConfirmationStatus =
  | "not_requested"
  | "requested"
  | "confirmed";

export interface PrismRegistrationPlatform {
  id: string;
  eventId: string;
  platformType: PrismRegistrationPlatformType;
  supplierId: string | null;
  expectedPaxMin: number;
  expectedPaxMax: number;
  status: PrismRegistrationPlatformStatus;
  /** Derived server-side from setupRequestedAt and setupConfirmedAt; not stored separately. */
  setupConfirmationStatus: PrismRegistrationPlatformSetupConfirmationStatus;
  setupRequestedAt: string | null;
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
  blockedReason?: string | null;
  blockedAt?: string | null;
  blockedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PrismEventTaskReassignmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "auto_approved"
  | string;

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

export type PrismScheduleSegmentStatus =
  | "planned"
  | "active"
  | "complete"
  | "skipped"
  | string;

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

/** Kinds of time-ordered run sheet entries (FL-026). */
export type PrismRunSheetEntryKind =
  | "segment"
  | "ingress"
  | "egress"
  | "task_due"
  | "issue";

/** Run sheet audience: PMCM/system see the full event; coordinators see their projected subset. */
export type PrismRunSheetScope = "pmcm" | "coordinator";

/**
 * One time-ordered run sheet line, built server-side from schedule segments,
 * supplier ingress/egress windows, open task due times and open issue creation
 * times. Entries never carry private supplier, finance or audit notes.
 */
export interface PrismRunSheetEntry {
  /** Stable key: `${kind}:${referenceId}`. */
  id: string;
  kind: PrismRunSheetEntryKind;
  at: string;
  endAt: string | null;
  title: string;
  status: string;
  /** Responsible role, person, or supplier label shown on the sheet. */
  ownerLabel: string;
  location: string;
  /** Id of the underlying segment, supplier schedule, task, or issue. */
  referenceId: string;
  /** Issue severity or task priority when relevant. */
  severity: string | null;
  /** True for still-open tasks/issues whose time is before the selected day. */
  carriedOver: boolean;
}

/**
 * Untimed guest operations block on the run sheet: registration platform state and expected headcount, guest roster
 * verification counts, walk-in policy, and registration/usher staffing. Carries counts and planned state only. It never
 * carries guest names, check-in records, or live check-in totals.
 */
export interface PrismRunSheetGuestOperations {
  /** Null until PMCM configures a registration platform for the event. */
  registrationPlatform: {
    platformType: PrismRegistrationPlatformType;
    status: PrismRegistrationPlatformStatus;
    setupConfirmationStatus: PrismRegistrationPlatformSetupConfirmationStatus;
    expectedPaxMin: number;
    expectedPaxMax: number;
  } | null;
  /** Null when the event has no walk-in policy recorded. */
  walkIn: { policy: "closed" | "open" | "threshold"; threshold: number | null } | null;
  /** Active (not withdrawn) roster entries by verification status. Counts only. */
  rosterVerification: { verified: number; pending: number; flagged: number };
  /** Active registration and usher assignments the viewer may see: all for PMCM and the designated operator, otherwise their own. */
  registrationStaff: Array<{ coordinatorName: string; role: string; status: string }>;
}

export interface PrismRunSheetDayOption {
  id: string;
  dayDate: string;
  label: string;
}

export interface PrismEventRunSheet {
  eventId: string;
  scope: PrismRunSheetScope;
  generatedAt: string;
  day: PrismEventScheduleDay;
  days: PrismRunSheetDayOption[];
  /** False when the actor's role does not receive supplier readiness or ingress/egress windows. */
  supplierWindowsVisible: boolean;
  /** Sorted by `at`, then kind (segment, ingress, egress, task_due, issue), then reference id. */
  entries: PrismRunSheetEntry[];
  coordinators: PrismCoordinatorAssignment[];
  supplierCommitments: Array<{
    id: string;
    supplierName: string;
    category: string;
    status: string;
    /** Empty outside PMCM scope; supplier event-day notes stay PMCM-only on the run sheet. */
    notes: string;
  }>;
  /** Null when the actor's role does not receive the guest operations block. */
  guestOperations: PrismRunSheetGuestOperations | null;
  openTasks: PrismEventDayTask[];
  openIssues: PrismUrgentIssue[];
}

export interface PrismEventRunSheetUnavailable {
  eventId: string;
  authored: false;
  reason: "no_schedule";
}

export type PrismEventRunSheetResult =
  | PrismEventRunSheet
  | PrismEventRunSheetUnavailable;

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
  canEdit: boolean;
  progress: string[];
  issues: string[];
  risksForTomorrow: string[];
  submittedAt: string;
  /** Set by PMCM when tasks named in this report are incomplete; null when not flagged. */
  incompleteTasksFlaggedAt: string | null;
  incompleteTasksFlaggedBy: string | null;
  replies: PrismEventEodReply[];
}

export interface PrismLiveOpsTimer {
  status:
    | "no_schedule"
    | "before_start"
    | "active"
    | "between_segments"
    | "complete";
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

export interface PrismCoordinatorLiveOps
  extends Omit<PrismLiveOps, "supplierStatuses" | "role"> {
  role: string;
  supplierStatuses: PrismCoordinatorSupplierStatus[];
}

export interface PrismCoordinatorRoleView
  extends Omit<PrismCoordinatorLiveOps, "eventDayLogs"> {
  assignment: PrismCoordinatorAssignment;
}

/** Published run sheet schedule and event status, readable by a coordinator assigned to the event. */
export interface PrismCoordinatorEventSchedule {
  eventId: string;
  eventStatus: string;
  schedule: PrismEventSchedule;
}
