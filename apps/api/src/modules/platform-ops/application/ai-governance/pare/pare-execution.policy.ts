import { ServiceUnavailableException } from '@nestjs/common';
import type { AiUseCaseId } from '@prism/types';
import { resolveAiRoute, type AiGatewayRuntimeConfig } from '../gateway/ai-gateway.config';
import { PARE_AI_USE_CASES } from './pare-ai-use-cases';

/**
 * Persisted value kept for compatibility with stored records.
 * 'mock' is PARE's deterministic rules engine: it ranks candidates and writes the messages from
 * fixed rules without calling a model. It is the offline fallback when no AI provider is configured.
 * 'live' routes the three PARE stages through the AI gateway.
 */
export type PAREMode = 'mock' | 'live';

export const PARE_USE_CASE_IDS = ['pare.budget', 'pare.risk', 'pare.message-drafts'] as const satisfies readonly AiUseCaseId[];

export class PareConfigurationError extends ServiceUnavailableException {
  readonly code = 'PARE_CONFIGURATION';
  constructor(message: string) {
    super(message);
    this.name = 'PareConfigurationError';
  }
}

type PareRuntimeView = Pick<AiGatewayRuntimeConfig, 'configured' | 'liveUseCases'>;

export function pareUseCasesAreLive(runtime: PareRuntimeView): boolean {
  return PARE_USE_CASE_IDS.every((id) => runtime.liveUseCases.has(id));
}

/**
 * PARE_MODE=live|mock forces a mode. When it is unset PARE runs live as soon as the gateway has a
 * provider and all three PARE use cases are live; otherwise it falls back to the rules engine.
 */
export function configuredPareMode(value: string | undefined, runtime?: PareRuntimeView): PAREMode {
  if (value === 'mock') return 'mock';
  if (value === 'live') return 'live';
  if (value !== undefined) throw new Error('PARE_MODE must be mock or live');
  return runtime?.configured && pareUseCasesAreLive(runtime) ? 'live' : 'mock';
}

/** Live PARE needs a provider with every PARE use case enabled. Data and production gates belong to AiGateway. */
export function assertLivePareRuntime(runtime: PareRuntimeView): void {
  if (!runtime.configured) {
    throw new PareConfigurationError('Live PARE requires a configured AI provider (set AI_PROVIDER and its API key)');
  }
  if (!pareUseCasesAreLive(runtime)) {
    throw new PareConfigurationError('Live PARE requires all three PARE use cases in AI_LIVE_USE_CASES');
  }
}

/**
 * How live PARE feeds the gateway, decided from the resolved route of each PARE use case.
 * 'registered-synthetic': at least one route is a fixtures-only lockdown, so the whole run must be a
 * registered synthetic provenance chain. 'real-data': every route allows real data (ZDR or
 * test-data-only), so event context goes through gateway minimization with masked identities.
 */
export type PareLiveInput = 'registered-synthetic' | 'real-data';

export function resolvePareLiveInput(runtime: Pick<AiGatewayRuntimeConfig, 'profile'>): PareLiveInput {
  const fixturesOnly = PARE_USE_CASE_IDS.some((id) =>
    resolveAiRoute(runtime.profile, id, PARE_AI_USE_CASES[id].modelTier).zdrBasis === 'none');
  return fixturesOnly ? 'registered-synthetic' : 'real-data';
}

/** Validate the compatibility mode; route and data gates belong to AiGateway. */
export function assertPareExecutionAllowed(mode: string): void {
  if (mode !== 'mock' && mode !== 'live') {
    throw new PareConfigurationError('PARE mode is unsupported. Use mock or live mode.');
  }
}
