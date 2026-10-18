import type { PrismProjectLike, PrismUserRole } from "./core.js";

export interface PrismInquiryMergeRecord {
  id: string;
  primaryInquiryId: string;
  mergedInquiryId: string;
  mergedInquiryName: string;
  matchBasis: "organization" | "email";
  reason: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
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
  organizationKey?: string | null;
  mergedIntoInquiryId?: string | null;
  mergeHistory?: PrismInquiryMergeRecord[];
  parallelInquiryIds?: string[];
  highFit?: boolean;
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

export interface PrismFloorPlanActor {
  name: string;
  role: string;
}

export interface PrismFloorPlanCreator extends PrismFloorPlanActor {
  actorId: string;
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
  status:
    | "client_submitted"
    | "pmcm_draft"
    | "in_review"
    | "revision_requested"
    | "approved"
    | string;
  isActive: boolean;
  sourceType: "client_preference" | "blank" | "template" | string;
  createdByRole?: PrismUserRole | string;
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
  venue?: string;
  walkInPolicy?: "closed" | "open" | "threshold";
  walkInThreshold?: number;
  actualEndedAt?: string | null;
  actualEndedBy?: string | null;
  status: string;
  clientPortalStatus: "locked" | "unlocked";
  clientEventDayViewEnabled?: boolean;
  readiness: string;
  archived: boolean;
  floorPlanStatus: string;
  floorPlanId?: string | null;
  guestAccessCode?: string;
  proposalClientStatus?: "pending" | "approved" | "revision_requested";
  proposalRevisionCount?: number;
  proposalReviewedAt?: string | null;
  proposalReviewedBy?: string | null;
  freezeStatus?: "open" | "frozen" | string;
  freezeAt?: string | null;
  freezeDeadlineAt?: string | null;
  freezeReason?: string;
  activeFloorPlanDraftId?: string;
  floorPlanDrafts?: PrismFloorPlanDraft[];
}

export interface PrismEventDecisionRescheduleConflict {
  assignmentId: string;
  coordinatorName: string;
  reason: "double_booking" | "unavailable";
  conflictEventId?: string;
  conflictEventName?: string;
}

export interface PrismEventDecisionAssignmentImpact {
  releasedAssignmentIds: string[];
  priorAssignments: Array<{
    id: string;
    status: string;
    coordinatorId: string | null;
    coordinatorName: string;
  }>;
  reschedule?: {
    toDate: string;
    assignmentIds: string[];
    conflicts: PrismEventDecisionRescheduleConflict[];
  };
}

export interface PrismEventDecision {
  id: string;
  eventId: string;
  decision: string;
  reason: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  actorEmail: string | null;
  decidedAt: string;
  priorState: { status: string; eventDate: string };
  financialImpact: Record<string, unknown>;
  assignmentImpact: PrismEventDecisionAssignmentImpact;
  supplierImpact: string;
  idempotencyKey: string | null;
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

export type PrismFileRequirementStatus =
  | "missing"
  | "pending"
  | "submitted"
  | "generated"
  | "approved"
  | "complete";

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
  confirmedDate?: string | null;
  confirmedStartTime?: string | null;
  confirmedEndTime?: string | null;
  program?: unknown[];
  moodAndStyling?: string;
  stylingBudget?: number | null;
}
