import type { AiGateway, AiSyntheticPareChain } from '../../../../contracts/ai-governance/ai-gateway.port';
import type { PAREBudgetAnalysis, PARECandidate, PAREContext } from '../pare.types';
import { assertPareExecutionAllowed } from '../pare-execution.policy';
import { PareAiGatewayError, runPareAiUseCase, type PareAgentRunResult } from '../pare-ai-gateway';
import { createPareBudgetToolHandlers } from '../pare-ai-use-cases';

function mockAnalysis(ctx: PAREContext, candidate: PARECandidate): PAREBudgetAnalysis {
  const costDelta = candidate.quotedAmount - ctx.withdrawnSupplier.quotedAmount;
  const feasible = candidate.quotedAmount === 0 || costDelta <= ctx.remainingBudget;
  const costDeltaLabel =
    costDelta === 0
      ? 'same cost as withdrawn supplier'
      : costDelta > 0
        ? `₱${Math.abs(costDelta).toLocaleString()} over withdrawn quote`
        : `₱${Math.abs(costDelta).toLocaleString()} under withdrawn quote (savings)`;

  const summary =
    candidate.quotedAmount === 0
      ? `${candidate.supplierName} has no quote on file. A new quote request is recommended before final confirmation.`
      : feasible
        ? `${candidate.supplierName} is within budget at ₱${candidate.quotedAmount.toLocaleString()} (${costDeltaLabel}).`
        : `${candidate.supplierName} at ₱${candidate.quotedAmount.toLocaleString()} exceeds available budget (${costDeltaLabel}). Escalate to Ms. Mys.`;

  return { feasible, selectedCandidate: candidate, costDelta, costDeltaLabel, summary };
}

export class BudgetAgent {
  constructor(
    private readonly mode: 'mock' | 'live' = 'mock',
    private readonly gateway?: AiGateway,
  ) {}

  async runPareBudgetAgent(
    ctx: PAREContext,
    signal?: AbortSignal,
    syntheticPareChain?: AiSyntheticPareChain,
  ): Promise<PareAgentRunResult<PAREBudgetAnalysis>> {
    assertPareExecutionAllowed(this.mode);
    throwIfAborted(signal);

    const top = (ctx.candidates ?? [])[0];
    if (!top) {
      if (this.mode === 'live') {
        throw new PareAiGatewayError('blocked', 'invalid_input', false);
      }
      return {
        evidence: null,
        output: {
          feasible: false,
          selectedCandidate: {
            supplierId: '',
            supplierName: 'No candidate found',
            tier: 'unknown',
            quotedAmount: 0,
            reliabilityScore: 0,
            halal: false,
            priorPmcmEvents: 0,
            reason: 'No available replacement suppliers found in the same category.',
          },
          costDelta: 0,
          costDeltaLabel: 'N/A',
          summary: 'No replacement candidates available for this category.',
        },
      };
    }

    if (this.mode === 'live') {
      return runPareAiUseCase(
        this.gateway,
        'pare.budget',
        ctx,
        createPareBudgetToolHandlers(ctx),
        signal,
        syntheticPareChain,
      );
    }

    return { output: mockAnalysis(ctx, top), evidence: null };
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
  }
}
