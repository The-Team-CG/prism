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
  addendumId: string;
  versionNumber: number;
  financialDelta: number;
  quotePriceChanges: AddendumQuotePriceChange[];
};

/**
 * The executed (client-acknowledged and PMCM-countersigned) addendum conforme version a billing record must reference.
 * billingSourceId comes from the addendum impact record Lifecycle wrote for this addendum; the billing line is matched by addendumId.
 */
export type RecordAddendumConformeInput = {
  eventId: string;
  addendumId: string;
  billingSourceId: string;
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
   * Stamps the billing line that carries this addendum's id with the executed conforme version. Replays of the same
   * execution are no-ops; a different execution already bound to the line is refused. Returns null when the source
   * has no line for the addendum (no financial delta, or an addendum issued before lines carried addendum ids).
   */
  recordConformeExecution(input: RecordAddendumConformeInput, transaction: PrismTransactionContext): Promise<CommercialAddendumConformeTrace | null>;
}

export const COMMERCIAL_ADDENDUM_IMPACT_WRITER = Symbol('COMMERCIAL_ADDENDUM_IMPACT_WRITER');
