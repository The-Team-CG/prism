import type { CreateSupplierReviewInput } from '@prism/types';

export type { CreateSupplierReviewInput } from '@prism/types';

export type SupplierProfile = {
  id: string;
  name: string;
  email?: string | null;
};

export type CreateSupplierInput = {
  categoryId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  tier?: string;
  bniMember?: boolean;
  serviceInclusions?: string;
  performanceNotes?: string;
};

export type UpdateSupplierInput = Partial<Omit<CreateSupplierInput, 'tier'>>;

export type ChangeSupplierTierInput = {
  tier: string;
  reason: string;
};

export type CreateSupplierCertificationInput = {
  fileName: string;
  documentType: string;
  issuer?: string;
  expiresAt?: string;
  status?: string;
  notes?: string;
};

export type ChangeSupplierTierResult = {
  supplier: SupplierProfile;
  oldTier?: string | null;
};

export type AddSupplierReviewResult = {
  supplier: SupplierProfile;
  reviewId: string;
  replayed?: boolean;
};

export interface SupplierDirectory {
  createSupplier(input: CreateSupplierInput): Promise<SupplierProfile>;
  updateSupplier(supplierId: string, input: UpdateSupplierInput): Promise<SupplierProfile>;
  changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput): Promise<ChangeSupplierTierResult>;
  addSupplierReview(supplierId: string, input: CreateSupplierReviewInput): Promise<AddSupplierReviewResult>;
  addSupplierCertification(supplierId: string, input: CreateSupplierCertificationInput): Promise<SupplierProfile>;
  listSuppliers(): Promise<SupplierProfile[]>;
}
