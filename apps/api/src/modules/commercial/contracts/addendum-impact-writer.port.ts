import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type AddendumQuotePriceChange = {
  quoteId: string;
  amount: number;
};

export type CommercialAddendumImpact = {
  targetType: 'billing_source' | 'supplier_quote';
  targetId: string;
  beforeValue: Record<string, unknown>;
  afterValue: Record<string, unknown>;
  deltaAmount: number;
};

/** The fully signed addendum conforme version that authorizes a billing change. */
export type ExecutedAddendumConformeReference = {
  executionId: string;
  documentVersion: number;
  documentSha256: string;
};

export type ApplyCommercialAddendumInput = {
  eventId: string;
  versionNumber: number;
  financialDelta: number;
  quotePriceChanges: AddendumQuotePriceChange[];
  /** Required: billing never records an addendum impact before the client and PMCM have both signed. */
  executedConforme: ExecutedAddendumConformeReference;
};

export type CommercialAddendumPreflightInput = {
  eventId: string;
  financialDelta: number;
};

export interface CommercialAddendumImpactWriter {
  /** Read-only check at issue time so an addendum that billing could never apply is rejected early. */
  assertApplicable(input: CommercialAddendumPreflightInput, transaction: PrismTransactionContext): Promise<void>;
  apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]>;
}

export const COMMERCIAL_ADDENDUM_IMPACT_WRITER = Symbol('COMMERCIAL_ADDENDUM_IMPACT_WRITER');
