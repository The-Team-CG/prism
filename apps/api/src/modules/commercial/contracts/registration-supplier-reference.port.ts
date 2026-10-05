import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type RegistrationSupplierReference = {
  id: string;
  registrationCategory: boolean;
  categoryActive: boolean;
  selectedForEvent: boolean;
};

/** Commercial-owned check for a supplier selected for Operations registration use. */
export interface RegistrationSupplierReferenceReader {
  findRegistrationSupplier(
    eventId: string,
    supplierId: string,
    transaction?: PrismTransactionContext,
  ): Promise<RegistrationSupplierReference | null>;
}

export const REGISTRATION_SUPPLIER_REFERENCE_READER = Symbol('REGISTRATION_SUPPLIER_REFERENCE_READER');