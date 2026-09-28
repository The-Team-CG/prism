import {
  aiAuditEvidenceSchema,
  type AiAuditEvidence,
  type AiFailureCode,
  type AiRunOutcome,
  type AiUseCaseOutput,
} from '@prism/types';
import type { AiGateway, AiToolHandler } from '../../../contracts/ai-governance/ai-gateway.port';
import type { PAREContext } from './pare.types';
import { PARE_AI_USE_CASES } from './pare-ai-use-cases';
import { PareConfigurationError } from './pare-execution.policy';

export type PareAiUseCaseId = 'pare.budget' | 'pare.risk' | 'pare.message-drafts';

export type PareAgentRunResult<TOutput> = {
  output: TOutput;
  evidence: AiAuditEvidence | null;
};

export class PareAiGatewayError extends Error {
  constructor(
    readonly outcome: Exclude<AiRunOutcome, 'completed'>,
    readonly code: AiFailureCode,
    readonly retryable: boolean,
  ) {
    super(`PARE AI gateway ${outcome}: ${code}`);
    this.name = 'PareAiGatewayError';
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
  }
}

function matchesPareRun(evidence: AiAuditEvidence, useCaseId: PareAiUseCaseId, triggerId: string): boolean {
  return evidence.useCaseId === useCaseId &&
    evidence.correlationId === triggerId &&
    evidence.outcome === 'completed';
}

export function isPareRoutePolicyEligibleEvidence(evidence: AiAuditEvidence): boolean {
  return (evidence.routePolicyOutcome === 'synthetic_verified' || evidence.routePolicyOutcome === 'zdr_approved') &&
    Boolean(evidence.syntheticProvenance);
}

export async function runPareAiUseCase<K extends PareAiUseCaseId>(
  gateway: AiGateway | undefined,
  useCaseId: K,
  context: PAREContext,
  tools: readonly AiToolHandler[],
  signal?: AbortSignal,
): Promise<PareAgentRunResult<AiUseCaseOutput<K>>> {
  if (!gateway) {
    throw new PareConfigurationError('PARE AI gateway is not registered; live PARE is disabled');
  }
  throwIfAborted(signal);

  const result = await gateway.run(useCaseId, context, {
    correlationId: context.triggerId,
    tools,
    signal,
  });
  if (result.outcome !== 'completed') {
    if (result.outcome === 'aborted' || signal?.aborted) throwIfAborted(signal);
    throw new PareAiGatewayError(result.outcome, result.error.code, result.error.retryable);
  }

  const evidenceResult = aiAuditEvidenceSchema.safeParse(result.evidence);
  if (!evidenceResult.success) {
    throw new PareAiGatewayError('failed', 'invalid_output', false);
  }
  const evidence = evidenceResult.data;
  if (!matchesPareRun(evidence, useCaseId, context.triggerId) || !isPareRoutePolicyEligibleEvidence(evidence)) {
    throw new PareAiGatewayError('blocked', 'synthetic_provenance_required', false);
  }

  const outputResult = PARE_AI_USE_CASES[useCaseId].outputSchema.safeParse(result.output);
  if (!outputResult.success) {
    throw new PareAiGatewayError('failed', 'invalid_output', false);
  }
  throwIfAborted(signal);
  return { output: outputResult.data as AiUseCaseOutput<K>, evidence };
}
