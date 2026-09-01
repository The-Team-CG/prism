import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { OpsSupplierQuoteRequest } from '@prisma/client';
import type {
  ChangeSupplierTierInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReviewInput,
  SupplierProfile,
  UpdateSupplierInput,
} from './supplier-directory.port';
import type { UploadMetadataInput } from './supplier-document-vault.port';
import type { SupplierPareApprovalRecord } from './supplier-pare-automation.port';

export type SupplierReadinessInput = {
  notes?: string;
};

export type SupplierEventStatusInput = {
  status: string;
  notes?: string;
  photo?: UploadMetadataInput;
};

export type VerifySupplierEventStatusInput = {
  verificationStatus: string;
  notes?: string;
};

export interface SupplierCommands {
  createSupplier(input: CreateSupplierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  updateSupplier(supplierId: string, input: UpdateSupplierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  addSupplierCertification(
    supplierId: string,
    input: CreateSupplierCertificationInput,
    actor: ResolvedEventOpsActor,
  ): Promise<SupplierProfile>;
  confirmSupplierAssignment(requestId: string, actor: ResolvedEventOpsActor): Promise<OpsSupplierQuoteRequest>;
  withdrawSupplier(requestId: string, reason: string, actor: ResolvedEventOpsActor): Promise<OpsSupplierQuoteRequest>;
  pareGetPendingApprovals(eventId?: string): Promise<SupplierPareApprovalRecord[]>;
  pareApprove(approvalRecordId: string, approvedBy: string): Promise<SupplierPareApprovalRecord>;
  pareReject(approvalRecordId: string, rejectedBy: string): Promise<SupplierPareApprovalRecord>;
  confirmSupplierReadiness(
    requestId: string,
    input: SupplierReadinessInput,
    actor: ResolvedEventOpsActor,
  ): Promise<OpsSupplierQuoteRequest>;
  updateSupplierEventStatus(
    requestId: string,
    input: SupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ): Promise<OpsSupplierQuoteRequest>;
  verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ): Promise<OpsSupplierQuoteRequest>;
  uploadSupplierContract(
    requestId: string,
    input: UploadMetadataInput,
    actor: ResolvedEventOpsActor,
  ): Promise<OpsSupplierQuoteRequest>;
}
