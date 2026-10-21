import type {
  ChangeSupplierTierInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReliabilityNoteInput,
  CreateSupplierReviewInput,
  PrismSupplierDirectoryProfile,
  PromoteSupplierInput,
  UpdateSupplierInput,
} from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type {
  ChangeSupplierTierInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReviewInput,
  UpdateSupplierInput,
} from '@prism/types';

export type SupplierProfile = PrismSupplierDirectoryProfile;

export type ChangeSupplierTierResult = {
  supplier: SupplierProfile;
  oldTier?: string | null;
};

export type AddSupplierReviewResult = {
  supplier: SupplierProfile;
  reviewId: string;
  replayed?: boolean;
};

export type SupplierPromotionResult = {
  supplier: SupplierProfile;
  replayed: boolean;
};

export interface SupplierDirectory {
  createSupplier(input: CreateSupplierInput): Promise<SupplierProfile>;
  updateSupplier(supplierId: string, input: UpdateSupplierInput): Promise<SupplierProfile>;
  changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput): Promise<ChangeSupplierTierResult>;
  addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, reviewedBy: string, context?: PrismTransactionContext): Promise<AddSupplierReviewResult>;
  addReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput, context?: PrismTransactionContext, createdBy?: string): Promise<{ supplier: SupplierProfile; noteId: string; replayed?: boolean }>;
  promoteSupplier(supplierId: string, input: PromoteSupplierInput, promotedBy: string, context?: PrismTransactionContext): Promise<SupplierPromotionResult>;
  addSupplierCertification(supplierId: string, input: CreateSupplierCertificationInput): Promise<SupplierProfile>;
  listSuppliers(): Promise<SupplierProfile[]>;
}
