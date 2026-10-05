import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type {
  ConfirmSupplierReadinessInput,
  ChangeSupplierTierInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReliabilityNoteInput,
  CreateSupplierReviewInput,
  CreateSupplierScheduleInput,
  PrismSupplierQuoteRequest,
  PrismSupplierSchedule,
  UpdateSupplierEventStatusInput,
  UpdateSupplierInput,
  UploadMetadataInput,
  VerifySupplierStatusInput,
  PromoteSupplierInput,
} from '@prism/types';
import type { SupplierProfile } from './supplier-directory.port';
import type { PAREApprovalRecord as SupplierPareApprovalRecord } from '@prism/contexts/platform-ops';

export type SupplierReadinessInput = ConfirmSupplierReadinessInput;
export type SupplierEventStatusInput = UpdateSupplierEventStatusInput;
export type VerifySupplierEventStatusInput = VerifySupplierStatusInput;

export interface SupplierCommands {
  createSupplier(input: CreateSupplierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  updateSupplier(supplierId: string, input: UpdateSupplierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  addReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  promoteSupplier(supplierId: string, input: PromoteSupplierInput, actor: ResolvedEventOpsActor): Promise<SupplierProfile>;
  addSupplierCertification(
    supplierId: string,
    input: CreateSupplierCertificationInput,
    actor: ResolvedEventOpsActor,
  ): Promise<SupplierProfile>;
  confirmSupplierAssignment(requestId: string, actor: ResolvedEventOpsActor): Promise<PrismSupplierQuoteRequest>;
  withdrawSupplier(requestId: string, reason: string, actor: ResolvedEventOpsActor): Promise<PrismSupplierQuoteRequest>;
  pareGetPendingApprovals(eventId?: string): Promise<SupplierPareApprovalRecord[]>;
  pareApprove(approvalRecordId: string, approvedBy: string): Promise<SupplierPareApprovalRecord>;
  pareReject(approvalRecordId: string, rejectedBy: string): Promise<SupplierPareApprovalRecord>;
  confirmSupplierReadiness(
    requestId: string,
    input: SupplierReadinessInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismSupplierQuoteRequest>;
  updateSupplierEventStatus(
    requestId: string,
    input: SupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismSupplierQuoteRequest>;
  verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismSupplierQuoteRequest>;
  uploadSupplierContract(
    requestId: string,
    input: UploadMetadataInput,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismSupplierQuoteRequest>;
  createSupplierSchedule(eventId: string, input: CreateSupplierScheduleInput, actor: ResolvedEventOpsActor): Promise<PrismSupplierSchedule>;
  listSupplierSchedules(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismSupplierSchedule[]>;
}
