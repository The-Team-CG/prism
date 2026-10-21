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
