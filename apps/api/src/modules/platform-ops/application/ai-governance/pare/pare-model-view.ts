import type { PAREBudgetAnalysis, PARECandidate, PAREContext } from './pare.types';
import { canonicalJson } from '../json-digest';
import { redactString } from '../gateway/pii-redaction';

/**
 * Identity masking for live PARE on real event data.
 *
 * The gateway flattens every supplier name to "Supplier X" and every id to a placeholder, which would
 * leave the model unable to tell candidates apart or say which one it picked. PARE therefore hands the
 * model a masked view: candidates become "Candidate N" (N is the rank, starting at 1) with stable
 * ids, and the client, event and withdrawn supplier names become placeholders. The same view feeds
 * the read-only tools, so no real name reaches the provider through a tool result either.
 *
 * The mapping is derived from candidate order alone, so it can be rebuilt from the saved review record.
 * That is what lets approval compare the saved budget analysis with the digest the gateway recorded.
 */

/** The rule-generated candidate note can quote supplier text, so the model gets a fixed line instead. */
export const MASKED_CANDIDATE_REASON = 'Ranked replacement candidate';
const MASKED_EVENT_NAME = 'Event';
const MASKED_CLIENT_NAME = 'Client A';
const MASKED_SUPPLIER_NAME = 'Supplier X';
const MASKED_SUPPLIER_ID = 'withdrawn-supplier';

export class PareModelViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PareModelViewError';
  }
}

function aliasId(index: number): string {
  return `candidate-${index + 1}`;
}

function aliasName(index: number): string {
  return `Candidate ${index + 1}`;
}

function aliasCandidate(candidate: PARECandidate, index: number): PARECandidate {
  return {
    ...candidate,
    supplierId: aliasId(index),
    supplierName: aliasName(index),
    reason: MASKED_CANDIDATE_REASON,
  };
}

function candidateIndex(candidates: readonly PARECandidate[], supplierId: string): number {
  return candidates.findIndex((candidate) => candidate.supplierId === supplierId);
}

/** The budget analysis as the model sees it: its selected candidate carries the masked identity. */
export function maskBudgetAnalysis(
  candidates: readonly PARECandidate[],
  analysis: PAREBudgetAnalysis,
): PAREBudgetAnalysis | null {
  const index = candidateIndex(candidates, analysis.selectedCandidate.supplierId);
  if (index < 0) return null;
  return { ...analysis, selectedCandidate: aliasCandidate(analysis.selectedCandidate, index) };
}

/** The context handed to the gateway and to the read-only tools on a real-data route. */
export function maskPareContext(ctx: PAREContext): PAREContext {
  const candidates = ctx.candidates ?? [];
  const masked: PAREContext = {
    ...ctx,
    eventName: MASKED_EVENT_NAME,
    clientName: MASKED_CLIENT_NAME,
    withdrawnSupplier: { ...ctx.withdrawnSupplier, id: MASKED_SUPPLIER_ID, name: MASKED_SUPPLIER_NAME },
    // Free-text preferences stay readable, but contact details inside them must not reach a tool result.
    clientPreferences: ctx.clientPreferences.map((preference) => redactString(preference)),
  };
  if (ctx.candidates) masked.candidates = candidates.map(aliasCandidate);
  if (ctx.budgetAnalysis) {
    const budget = maskBudgetAnalysis(candidates, ctx.budgetAnalysis);
    if (!budget) throw new PareModelViewError('The selected PARE candidate is not one of the ranked candidates');
    masked.budgetAnalysis = budget;
  }
  return masked;
}

/**
 * Maps the model's budget analysis back to the real candidate. The model must have copied the
 * candidate it chose unchanged; anything else is rejected so the saved result stays reproducible.
 */
export function unmaskBudgetAnalysis(
  candidates: readonly PARECandidate[],
  modelOutput: PAREBudgetAnalysis,
): PAREBudgetAnalysis {
  const index = candidates.findIndex((_, position) => modelOutput.selectedCandidate.supplierId === aliasId(position));
  const real = index < 0 ? undefined : candidates[index];
  if (!real || canonicalJson(modelOutput.selectedCandidate) !== canonicalJson(aliasCandidate(real, index))) {
    throw new PareModelViewError('The selected candidate is not an unchanged copy of a ranked candidate');
  }
  return { ...modelOutput, selectedCandidate: { ...real } };
}
