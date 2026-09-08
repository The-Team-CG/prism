import type { PAREApprovalRecord } from '../../application/ai-governance/pare/pare.types';

export type PareApprovalGovernance = {
  getPendingApprovals(eventId?: string): Promise<PAREApprovalRecord[]>;
  approveRecommendation(approvalRecordId: string, approvedBy: string): Promise<PAREApprovalRecord>;
  rejectRecommendation(approvalRecordId: string, rejectedBy: string): Promise<PAREApprovalRecord>;
};
