import { describe, expect, it } from 'vitest';
import type { AiRoute, AiRouteProfile } from '@prism/types';
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
    expect(() => runtime({ AI_LIVE_USE_CASES: 'pare.not-registered' })).toThrow(/unsupported AI live use case/i);
  });

  it('defaults an omitted profile to mock', () => {
    expect(runtime({}).profileId).toBe('mock');
  });

  it('rejects synthetic-only external routes in production', () => {
    expect(() => runtime({ AI_ROUTE_PROFILE: profile.id, NODE_ENV: 'production' }))
      .toThrow(/synthetic-only.*production/i);
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
