import type {
  AiAuditEvidence,
  AiPareBudgetAnalysis,
  AiPareCandidate,
  AiPareContext,
  AiPareDrafts,
  AiPareRisk,
  AiPareRiskLevel,
} from '@prism/types';

export type {
  AiPareBudgetAnalysis,
  AiPareCandidate,
  AiPareContext,
  AiPareDrafts,
  AiPareRisk,
  AiPareRiskLevel,
} from '@prism/types';

export type PAREContext = AiPareContext;
export type PARECandidate = AiPareCandidate;
export type PAREBudgetAnalysis = AiPareBudgetAnalysis;
export type PARERiskLevel = AiPareRiskLevel;
export type PARERisk = AiPareRisk;
export type PAREDrafts = AiPareDrafts;

export type PAREResult = {
  requestId: string;
  eventId: string;
  eventName: string;
  withdrawnSupplier: {
    id: string;
    name: string;
    category: string;
    tier: string;
    quotedAmount: number;
  };
  candidates: PARECandidate[];
  budgetAnalysis: PAREBudgetAnalysis;
  riskAssessment: PARERisk;
  drafts: PAREDrafts;
  mode: 'mock' | 'live';
  runEvidence: AiAuditEvidence[];
  triggeredAt: string;
};

export type PAREApprovalStatus = 'pending' | 'approved' | 'rejected';

export type PAREApprovalRecord = {
  id: string;
  eventId: string;
  requestId: string;
  status: PAREApprovalStatus;
  pareResult: PAREResult;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
