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
  decidedAt: string;
}

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
