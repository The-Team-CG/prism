import type { RiskLevel, ScopeChangeCategory } from "../schemas/scope-change-risk-inputs.js";


export type PrismScopeChangeStatus = "submitted" | "under_review" | "approved" | "rejected" | "withdrawn";

/** PMCM register view of a scope change request. Never sent to clients; see PrismClientChangeRequest. */
export interface PrismScopeChangeRequest {
  id: string;
  eventId: string;
  requestedByRole: "client" | "pmcm";
  requestedBy: string;
  title: string;
  description: string;
  category: ScopeChangeCategory;
  status: PrismScopeChangeStatus;
  decisionReason: string | null;
  clientResponse: string | null;
  impacts: { billing: boolean; supplier: boolean; coordinator: boolean; floorplan: boolean };
  impactReviewedAt: string | null;
  freezeExceptionId: string | null;
  addendumId: string | null;
  reviewedBy: string | null;
  decidedBy: string | null;
  submittedAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
}

export interface PrismEventRiskAssessment {
  eventId: string;
  level: RiskLevel;
  summary: string;
  mitigations: string;
  revision: number;
  assessedBy: string;
  assessedAt: string;
}

export interface PrismEventRiskAssessmentRevision {
  id: string;
  revision: number;
  level: RiskLevel;
  previousLevel: RiskLevel | null;
  suggestedLevel: RiskLevel;
  summary: string;
  mitigations: string;
  reason: string;
  assessedBy: string;
  assessedAt: string;
}

/** PMCM-only. The suggested level is derived from open compliance risks; the recorded level is authoritative. */
export interface PrismEventRiskView {
  eventId: string;
  suggestedLevel: RiskLevel;
  openRiskCounts: Record<RiskLevel, number>;
  assessment: PrismEventRiskAssessment | null;
  history: PrismEventRiskAssessmentRevision[];
}
