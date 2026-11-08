export type PrismClientReviewItemKind = "venue" | "styling";
export type PrismClientReviewItemStatus = "draft" | "published" | "withdrawn";
export type PrismClientReviewAction = "approve" | "request_revision";
export type PrismClientFloorPlanAction = "approve" | "request_revision";

export interface PrismClientReviewItem {
  id: string;
  eventId: string;
  kind: PrismClientReviewItemKind;
  title: string;
  summary: string;
  version: number;
  status: PrismClientReviewItemStatus;
  budgetRange?: string;
  documentId?: string;
  publishedAt?: string;
  createdAt: string;
  clientDecision?: PrismClientReviewDecision | null;
}

export interface PrismClientReviewDecision {
  id: string;
  itemId: string;
  itemVersion: number;
  action: PrismClientReviewAction;
  comment: string;
  /** FR-09: present on a styling revision request. */
  budgetExpectation?: "raise_budget" | "lower_cost_option" | "keep_budget";
  decidedAt: string;
}

export const BUDGET_EXPECTATION_LABELS = {
  raise_budget: "Raise the styling budget",
  lower_cost_option: "Ask for a lower-cost option",
  keep_budget: "Keep the budget and change the design",
} as const;

export interface PrismClientFloorPlanDecision {
  id: string;
  eventId: string;
  draftId: string;
  snapshotHash: string;
  action: PrismClientFloorPlanAction;
  comment: string;
  decidedAt: string;
}

export interface PrismClientFloorPlanAnnotation {
  id: string;
  eventId: string;
  draftId: string;
  snapshotHash: string;
  objectId?: string;
  comment: string;
  anchorX?: number;
  anchorY?: number;
  /** Notes from contacts other than the primary client contact: visible, but never approve, request changes or count as the client response. */
  nonBinding: boolean;
  createdAt: string;
}

export interface PrismClientFloorPlanReview {
  draftId: string;
  snapshotHash: string;
  snapshot: unknown;
  decisions: PrismClientFloorPlanDecision[];
  annotations: PrismClientFloorPlanAnnotation[];
}

export interface PrismClientCloseoutResponse {
  eventId: string;
  rating: number;
  feedback: string;
  testimonial: string;
  testimonialConsent: boolean;
  moderationStatus: "pending" | "approved" | "rejected" | "withdrawn";
  submittedAt: string;
}

export interface PrismClientCloseoutDeliverable {
  id: string;
  title: string;
  status: string;
  required: boolean;
  acknowledgedAt: string | null;
  /** An acknowledgement exists, including one recorded separately by PMCM. */
  acknowledgementRecorded?: boolean;
  acknowledgementNote: string;
}

export interface PrismClientCloseoutWorkspace {
  eventId: string;
  actualEndedAt: string | null;
  wrapUp: {
    status: "pending" | "complete";
    clientAcknowledgedAt: string | null;
    acknowledgementRecorded?: boolean;
    acknowledgementNote: string;
  } | null;
  deliverables: PrismClientCloseoutDeliverable[];
  response: PrismClientCloseoutResponse | null;
}

/** FR-09 / FR-30: storage target for a moodboard image attached to one styling option. */
export function stylingMoodboardTarget(itemId: string, attemptId: string): string {
  return `styling-moodboard:${itemId}:${attemptId}`;
}

/** The stored moodboard images of one styling option, from an event's stored-object list. */
export function stylingMoodboardImages<T extends { ownerRecordType: string; ownerRecordId: string; lifecycleState: string }>(objects: readonly T[], itemId: string): T[] {
  return objects.filter((object) => object.ownerRecordType === "client_review_item" && object.ownerRecordId === itemId && object.lifecycleState === "stored");
}
