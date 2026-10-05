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

export type ApplyCommercialAddendumInput = {
  eventId: string;
  versionNumber: number;
  financialDelta: number;
  quotePriceChanges: AddendumQuotePriceChange[];
};

export interface CommercialAddendumImpactWriter {
  apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]>;
}

export const COMMERCIAL_ADDENDUM_IMPACT_WRITER = Symbol('COMMERCIAL_ADDENDUM_IMPACT_WRITER');
