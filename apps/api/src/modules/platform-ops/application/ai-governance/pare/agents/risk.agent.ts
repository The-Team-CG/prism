import type { AiGateway, AiSyntheticPareChain } from '../../../../contracts/ai-governance/ai-gateway.port';
import type { PARERisk, PARERiskLevel, PAREContext, PARECandidate } from '../pare.types';
import { assertPareExecutionAllowed } from '../pare-execution.policy';
import { runPareAiUseCase, type PareAgentRunResult } from '../pare-ai-gateway';
import { createPareRiskToolHandlers } from '../pare-ai-use-cases';

function timelineRisk(daysUntilEvent: number) {
  if (daysUntilEvent <= 7) {
    return { factor: `Critical timeline: event is in ${daysUntilEvent} day(s)`, score: 3 };
  }
  if (daysUntilEvent <= 21) {
    return { factor: `Short timeline: event is in ${daysUntilEvent} days`, score: 2 };
  }
  return { factor: `Adequate timeline: event is in ${daysUntilEvent} days`, score: 0 };
}

function replacementTierFactor(top: PARECandidate) {
  if (top.tier === 'tier_3') {
    return { factor: `Replacement is Tier 3 (${top.supplierName}) — unproven`, score: 2 };
  }
  if (top.tier === 'tier_2') {
    return { factor: `Replacement is Tier 2 (${top.supplierName}) — previously worked with PMCM`, score: 1 };
  }
  return { factor: `Replacement is Tier 1 (${top.supplierName}) — preferred partner`, score: 0 };
}

function candidateRisk(top: PARECandidate | undefined) {
  if (!top) {
    return { factors: ['No replacement candidates found — high operational risk'], score: 4 };
  }
  const tier = replacementTierFactor(top);
  const factors = [tier.factor];
  let score = tier.score;
  if (top.quotedAmount === 0) {
    factors.push('No quote on file — pricing unconfirmed');
    score += 1;
  }
  if (top.priorPmcmEvents === 0) {
    factors.push('No prior events with PMCM — first booking');
    score += 1;
  }
  if (top.reliabilityScore < 0.6) {
    factors.push(`Low reliability score (${top.reliabilityScore})`);
    score += 1;
  }
  return { factors, score };
}

function halalRisk(ctx: PAREContext, top: PARECandidate | undefined) {
  const requiresHalal = ctx.clientPreferences.some((preference) => preference.toLowerCase().includes('halal'));
  if (requiresHalal && top && !top.halal) {
    return { factor: 'Client requires halal — replacement is NOT halal-certified', score: 2 };
  }
  return { factor: undefined, score: 0 };
}

function riskLevel(score: number): PARERiskLevel {
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

const RISK_RECOMMENDATION: Record<PARERiskLevel, string> = {
  HIGH: 'Escalate to Ms. Mys immediately. Do not confirm without her explicit sign-off.',
  MEDIUM: 'Proceed with caution. Confirm details and brief client before finalizing.',
  LOW: 'Proceed with replacement. Standard confirmation and readiness check apply.',
};

function mockRisk(ctx: PAREContext): PARERisk {
  const timeline = timelineRisk(ctx.daysUntilEvent);
  const top = ctx.candidates?.[0];
  const candidate = candidateRisk(top);
  const halal = halalRisk(ctx, top);
  const factors = [timeline.factor, ...candidate.factors];
  if (halal.factor) factors.push(halal.factor);
  const score = timeline.score + candidate.score + halal.score;
  const level = riskLevel(score);
  return { level, factors, recommendation: RISK_RECOMMENDATION[level] };
}

export class RiskAgent {
  constructor(
    private readonly mode: 'mock' | 'live' = 'mock',
    private readonly gateway?: AiGateway,
  ) {}

  async runPareRiskAgent(
    ctx: PAREContext,
    signal?: AbortSignal,
    syntheticPareChain?: AiSyntheticPareChain,
  ): Promise<PareAgentRunResult<PARERisk>> {
    assertPareExecutionAllowed(this.mode);
    throwIfAborted(signal);
    if (this.mode === 'live') {
      return runPareAiUseCase(
        this.gateway,
        'pare.risk',
        ctx,
        createPareRiskToolHandlers(ctx),
        signal,
        syntheticPareChain,
      );
    }
    return { output: mockRisk(ctx), evidence: null };
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
  }
}
