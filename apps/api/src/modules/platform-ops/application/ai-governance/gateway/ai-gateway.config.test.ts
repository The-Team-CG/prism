import { describe, expect, it } from 'vitest';
import { aiUseCaseIdSchema, type AiDataClass, type AiRoute, type AiRouteProfile } from '@prism/types';
import {
  AI_ROUTE_PROFILES,
  computeAiRouteRevision,
  resolveAiGatewayRuntimeConfig,
  resolveAiRoute,
} from './ai-gateway.config';

const route: AiRoute = {
  provider: 'anthropic',
  model: 'claude-sonnet-test',
  endpointPolicyId: 'anthropic-direct',
  adapterRevision: 'anthropic-conformance-v1',
  zdrBasis: 'none',
  allowedDataClasses: ['synthetic'],
};

const profile: AiRouteProfile = {
  id: 'test-route-selection',
  routesByTier: {
    fast: { ...route, model: 'fast-tier-model' },
    strong: { ...route, model: 'strong-tier-model' },
  },
  routesByUseCase: {
    'pare.risk': { ...route, model: 'risk-override-model' },
  },
};

function runtime(values: Record<string, string | undefined>, profiles = {
  ...AI_ROUTE_PROFILES,
  [profile.id]: profile,
}) {
  return resolveAiGatewayRuntimeConfig({ get: (key: string) => values[key] }, profiles);
}

describe('AI gateway route configuration', () => {
  it('uses a use-case route override and falls back to the tier route', () => {
    expect(resolveAiRoute(profile, 'pare.risk', 'fast').model).toBe('risk-override-model');
    expect(resolveAiRoute(profile, 'pare.budget', 'strong').model).toBe('strong-tier-model');
  });

  it('rejects an explicitly unknown profile even when the live allowlist is empty', () => {
    expect(() => runtime({ AI_ROUTE_PROFILE: 'unknown-profile' })).toThrow(/unsupported AI_ROUTE_PROFILE/i);
  });

  it('rejects an explicitly unknown live use case at startup', () => {
    expect(() => runtime({ AI_PROVIDER: 'anthropic', AI_LIVE_USE_CASES: 'pare.not-registered' }))
      .toThrow(/unsupported AI live use case/i);
  });

  it('configures nothing and enables no use case when no provider is selected', () => {
    for (const values of [{}, { AI_ZDR_CONFIRMED: 'true' }, { NODE_ENV: 'production', AI_LIVE_USE_CASES: 'comms.draft' }]) {
      const result = runtime(values);
      expect(result.profileId).toBe('unconfigured');
      expect(result.configured).toBe(false);
      expect(result.liveUseCases.size).toBe(0);
    }
  });

  it('selects the provider from AI_PROVIDER or a single API key in any environment and enables every use case', () => {
    const allUseCases = aiUseCaseIdSchema.options;
    const cases = [
      [{ AI_PROVIDER: 'anthropic' }, 'anthropic-test-data'],
      [{ AI_PROVIDER: 'Anthropic', AI_ZDR_CONFIRMED: 'true' }, 'anthropic-zdr'],
      [{ ANTHROPIC_API_KEY: 'key', NODE_ENV: 'development' }, 'anthropic-test-data'],
      [{ ANTHROPIC_API_KEY: 'key', AI_ZDR_CONFIRMED: '1', NODE_ENV: 'production' }, 'anthropic-zdr'],
      [{ OPENROUTER_API_KEY: 'key', NODE_ENV: 'test' }, 'openrouter-zdr'],
      [{ AI_PROVIDER: 'openrouter', NODE_ENV: 'production' }, 'openrouter-zdr'],
    ] as const;
    for (const [values, profileId] of cases) {
      const result = runtime(values);
      expect(result.profileId, JSON.stringify(values)).toBe(profileId);
      expect(result.configured).toBe(true);
      expect([...result.liveUseCases].sort()).toEqual([...allUseCases].sort());
    }
  });

  it('narrows the live use cases with AI_LIVE_USE_CASES', () => {
    const result = runtime({ AI_PROVIDER: 'anthropic', AI_LIVE_USE_CASES: ' comms.draft , pare.risk ' });
    expect([...result.liveUseCases].sort()).toEqual(['comms.draft', 'pare.risk']);
  });

  it('refuses ambiguous or conflicting provider selection', () => {
    expect(() => runtime({ ANTHROPIC_API_KEY: 'a', OPENROUTER_API_KEY: 'b' })).toThrow(/set AI_PROVIDER explicitly/i);
    expect(() => runtime({ AI_PROVIDER: 'openrouter', AI_ROUTE_PROFILE: 'anthropic-zdr' })).toThrow(/conflicts with AI_ROUTE_PROFILE/i);
    expect(() => runtime({ AI_PROVIDER: 'gemini' })).toThrow(/unsupported AI_PROVIDER/i);
  });

  it('lets non-ZDR Anthropic take real data as a test-data route and keeps fixtures-only as an explicit lockdown', () => {
    const route = (profileId: string) => AI_ROUTE_PROFILES[profileId].routesByTier.strong;
    for (const profileId of ['anthropic-zdr', 'openrouter-zdr']) {
      expect(route(profileId).zdrBasis).toBe('provider-enforced');
      expect(route(profileId).allowedDataClasses).toContain('personal');
    }
    expect(route('anthropic-test-data').zdrBasis).toBe('test-data-only');
    expect(route('anthropic-test-data').allowedDataClasses).toEqual(expect.arrayContaining(['internal', 'personal']));
    expect(route('anthropic-synthetic').zdrBasis).toBe('none');
    expect(route('anthropic-synthetic').allowedDataClasses).toEqual(['synthetic']);
    // Fixtures-only is never chosen by provider selection.
    expect(runtime({ AI_PROVIDER: 'anthropic' }).profileId).not.toBe('anthropic-synthetic');
  });

  it('refuses non-ZDR routes in production unless the operator allows a UAT deployment', () => {
    expect(() => runtime({ AI_PROVIDER: 'anthropic', NODE_ENV: 'production' })).toThrow(/must be ZDR.*AI_ALLOW_TEST_DATA_IN_PRODUCTION/i);
    expect(() => runtime({ AI_ROUTE_PROFILE: 'anthropic-synthetic', NODE_ENV: 'production' })).toThrow(/must be ZDR/i);
    expect(runtime({ AI_PROVIDER: 'anthropic', AI_ZDR_CONFIRMED: 'true', NODE_ENV: 'production' }).profileId).toBe('anthropic-zdr');
    expect(runtime({ AI_PROVIDER: 'openrouter', NODE_ENV: 'production' }).profileId).toBe('openrouter-zdr');
    const uat = runtime({ AI_PROVIDER: 'anthropic', NODE_ENV: 'production', AI_ALLOW_TEST_DATA_IN_PRODUCTION: 'true' });
    expect(uat.profileId).toBe('anthropic-test-data');
    expect(uat.allowTestDataInProduction).toBe(true);
  });

  it('changes the reviewed route revision when the model or endpoint policy changes', () => {
    const revision = computeAiRouteRevision(profile, 'pare.risk', 'fast');
    const changedModel: AiRouteProfile = {
      ...profile,
      routesByUseCase: { 'pare.risk': { ...route, model: 'another-model' } },
    };
    const changedEndpoint: AiRouteProfile = {
      ...profile,
      routesByUseCase: { 'pare.risk': { ...route, endpointPolicyId: 'anthropic-eu' } },
    };
    expect(computeAiRouteRevision(changedModel, 'pare.risk', 'fast')).not.toBe(revision);
    expect(computeAiRouteRevision(changedEndpoint, 'pare.risk', 'fast')).not.toBe(revision);
    expect(revision).toMatch(/^[a-f0-9]{64}$/);
  });
});
