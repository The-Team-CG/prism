import type { PAREBudgetAnalysis, PARECandidate, PAREContext } from "@prism/types";
import { formatPeso } from "./money.js";

/**
 * Step 3 — the deterministic budget verdict.
 *
 * This is the whole answer in `mock` mode, and the fallback in `live` mode when
 * the model does not submit an analysis within its step budget. A candidate with
 * no quote on file counts as feasible; PMCM is told to request a quote instead.
 */
export function analyzePareBudget(ctx: PAREContext, candidate: PARECandidate): PAREBudgetAnalysis {
  const costDelta = candidate.quotedAmount - ctx.withdrawnSupplier.quotedAmount;
  const feasible = candidate.quotedAmount === 0 || costDelta <= ctx.remainingBudget;
  const costDeltaLabel =
    costDelta === 0
      ? "same cost as withdrawn supplier"
      : costDelta > 0
        ? `${formatPeso(Math.abs(costDelta))} over withdrawn quote`
        : `${formatPeso(Math.abs(costDelta))} under withdrawn quote (savings)`;

  const summary =
    candidate.quotedAmount === 0
      ? `${candidate.supplierName} has no quote on file. A new quote request is recommended before final confirmation.`
      : feasible
        ? `${candidate.supplierName} is within budget at ${formatPeso(candidate.quotedAmount)} (${costDeltaLabel}).`
        : `${candidate.supplierName} at ${formatPeso(candidate.quotedAmount)} exceeds available budget (${costDeltaLabel}). Escalate to Ms. Mys.`;

  return { feasible, selectedCandidate: candidate, costDelta, costDeltaLabel, summary };
}

/** The verdict when the category yielded no replacement at all. */
export function noCandidateBudgetAnalysis(): PAREBudgetAnalysis {
  return {
    feasible: false,
    selectedCandidate: {
      supplierId: "",
      supplierName: "No candidate found",
      tier: "unknown",
      quotedAmount: 0,
      reliabilityScore: 0,
      halal: false,
      priorPmcmEvents: 0,
      reason: "No available replacement suppliers found in the same category.",
    },
    costDelta: 0,
    costDeltaLabel: "N/A",
    summary: "No replacement candidates available for this category.",
  };
}
