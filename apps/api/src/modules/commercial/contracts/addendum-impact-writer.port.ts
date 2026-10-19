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

/** The executed (client-acknowledged and PMCM-countersigned) addendum conforme version a billing record must reference. */
export type RecordAddendumConformeInput = {
  eventId: string;
  addendumId: string;
  versionNumber: number;
  executionId: string;
  documentSha256: string;
  executedAt: string;
};

export type CommercialAddendumConformeTrace = {
  /** Billing source whose addendum line now references the executed conforme version. */
  billingSourceId: string;
};

export interface CommercialAddendumImpactWriter {
  apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]>;
  /**
   * Stamps the addendum scope-change billing line with the executed conforme version. Replays are no-ops.
   * Returns null when the addendum has no financial delta and therefore no billing line to trace.
   */
  recordConformeExecution(input: RecordAddendumConformeInput, transaction: PrismTransactionContext): Promise<CommercialAddendumConformeTrace | null>;
}

export const COMMERCIAL_ADDENDUM_IMPACT_WRITER = Symbol('COMMERCIAL_ADDENDUM_IMPACT_WRITER');
