import type { OpsEvent, OpsSupplierQuoteRequest } from '@prisma/client';

export type SupplierPareApprovalRecord = {
  id: string;
  eventId: string;
  requestId?: string;
  pareResult?: {
    budgetAnalysis?: {
      selectedCandidate?: {
        supplierName?: string;
      };
    };
    mode?: string;
  };
};

export interface SupplierPareAutomation {
  getPendingApprovals(eventId?: string): Promise<SupplierPareApprovalRecord[]>;
  approveRecommendation(approvalRecordId: string, approvedBy: string): Promise<SupplierPareApprovalRecord>;
  rejectRecommendation(approvalRecordId: string, rejectedBy: string): Promise<SupplierPareApprovalRecord>;
  handleEmergencyTrigger(
    requestId: string,
    prefetched?: { request: OpsSupplierQuoteRequest; event: OpsEvent },
  ): Promise<SupplierPareApprovalRecord>;
}
