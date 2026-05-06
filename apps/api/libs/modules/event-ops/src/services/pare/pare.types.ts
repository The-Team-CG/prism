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
  approvalRecordId: string;
  eventId: string;
  eventName: string;
  withdrawnSupplier: string;
  recommendedReplacement: string;
  recommendedAmount: number;
  costDelta: number;
  riskLevel: PARERiskLevel;
  riskFactors: string[];
  supplierNotificationDraft: string;
  clientReassuranceDraft: string;
  status: string;
  triggeredAt: string;
};
