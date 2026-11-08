import type { PrismSupplierReliabilityScore } from '@prism/types';

/** Successes out of observations for one reliability factor. */
export type ReliabilityFactorFacts = { successes: number; observations: number };

export const RELIABILITY_WEIGHTS = { onTime: 0.35, noComplaints: 0.25, responsive: 0.25, contractAccuracy: 0.15 } as const;
type Factor = keyof typeof RELIABILITY_WEIGHTS;

/** Beta(1,1) prior: with no history every factor starts at 50% with a wide band, and evidence narrows it. */
function posterior({ successes, observations }: ReliabilityFactorFacts) {
  const mean = (successes + 1) / (observations + 2);
  return { mean, variance: (mean * (1 - mean)) / (observations + 3) };
}

/**
 * FR-AI-06: a Bayesian weighted reliability score from on-time arrival, complaint rate, quote response time and contract
 * mismatch frequency, with a 95% band. It is a statistic, not a model call.
 */
export function supplierReliabilityScore(facts: Record<Factor, ReliabilityFactorFacts>): PrismSupplierReliabilityScore {
  let score = 0;
  let variance = 0;
  const factors = (Object.keys(RELIABILITY_WEIGHTS) as Factor[]).map((factor) => {
    const { mean, variance: factorVariance } = posterior(facts[factor]);
    score += RELIABILITY_WEIGHTS[factor] * mean;
    variance += RELIABILITY_WEIGHTS[factor] ** 2 * factorVariance;
    return { factor, rate: Math.round(mean * 100), observations: facts[factor].observations };
  });
  const margin = 1.96 * Math.sqrt(variance);
  const pct = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100);
  return { score: pct(score), low: pct(score - margin), high: pct(score + margin), observations: factors.reduce((sum, item) => sum + item.observations, 0), factors };
}
