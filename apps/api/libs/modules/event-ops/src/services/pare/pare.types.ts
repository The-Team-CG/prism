export type PAREContext = {
  triggerId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  daysUntilEvent: number;
  clientName: string;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  withdrawnSupplier: {
    id: string;
    name: string;
    category: string;
    tier: string;
    quotedAmount: number;
  };
  clientPreferences: string[];
  candidates?: PARECandidate[];
  budgetAnalysis?: PAREBudgetAnalysis;
  riskAssessment?: PARERisk;
  drafts?: PAREDrafts;
};

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

export type PARERiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type PARERisk = {
  level: PARERiskLevel;
  factors: string[];
  recommendation: string;
};

export type PAREDrafts = {
  supplierNotification: string;
  clientReassurance: string;
};

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
