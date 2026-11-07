import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { AddendumPlannedImpacts } from '@prism/types';

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

/** Read-only input for the plan that issuing an addendum stores. Writes nothing. */
export type PreviewCommercialAddendumInput = {
  eventId: string;
  financialDelta: number;
  quotePriceChanges: AddendumQuotePriceChange[];
};

/** Countersignature input: the plan stored at issue, applied once when the addendum becomes effective. */
export type ApplyCommercialAddendumInput = {
  eventId: string;
  addendumId: string;
  versionNumber: number;
  plan: AddendumPlannedImpacts;
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
  /**
   * Read-only. Resolves the approved billing source and the current selected-quote amounts that an addendum would change.
   * Refuses a financial delta when no approved billing source exists. Quotes that are not selected in this event are skipped.
   */
  preview(input: PreviewCommercialAddendumInput, transaction: PrismTransactionContext): Promise<AddendumPlannedImpacts>;
  /**
   * Writes the planned billing and selected-quote changes. Every baseline in the plan must still match the stored value;
   * otherwise the call throws a conflict and the caller's transaction rolls back.
   */
  apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]>;
  /**
   * Stamps the billing line that carries this addendum's id with the executed conforme version. Replays of the same
   * execution are no-ops; a different execution already bound to the line is refused. Returns null when the source
   * has no line for the addendum (no financial delta, or an addendum issued before lines carried addendum ids).
   */
  recordConformeExecution(input: RecordAddendumConformeInput, transaction: PrismTransactionContext): Promise<CommercialAddendumConformeTrace | null>;
}

export const COMMERCIAL_ADDENDUM_IMPACT_WRITER = Symbol('COMMERCIAL_ADDENDUM_IMPACT_WRITER');
