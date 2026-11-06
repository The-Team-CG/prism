import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { AiRouteProfile } from '@prism/types';
import { AI_ROUTE_PROFILES, resolveAiGatewayRuntimeConfig } from './application/ai-governance/gateway/ai-gateway.config';
import { AnthropicProviderAdapter } from './infrastructure/ai-governance/anthropic-provider.adapter';
import { OpenRouterProviderAdapter } from './infrastructure/ai-governance/openrouter-provider.adapter';
import { createAiProviderAdapters } from './platform-ops.module';

function runtime(
  values: Record<string, string | undefined> = {},
  extraProfiles: Readonly<Record<string, AiRouteProfile>> = {},
) {
  return resolveAiGatewayRuntimeConfig(
    { get: (key: string) => values[key] },
    { ...AI_ROUTE_PROFILES, ...extraProfiles },
  );
}

function keyConfig(value?: string, keyName = 'ANTHROPIC_API_KEY') {
  return {
    get: vi.fn((key: string) => key === keyName ? value : undefined),
  } as unknown as Pick<ConfigService, 'get'>;
}

const openRouterTestProfile: AiRouteProfile = {
  id: 'test-openrouter',
  routesByTier: {
    fast: {
      provider: 'openrouter', model: 'test/openrouter-model', endpointPolicyId: 'test-upstream',
      adapterRevision: 'openrouter-compat-test-v1', zdrBasis: 'none', allowedDataClasses: ['synthetic'],
    },
    strong: {
      provider: 'openrouter', model: 'test/openrouter-model', endpointPolicyId: 'test-upstream',
      adapterRevision: 'openrouter-compat-test-v1', zdrBasis: 'none', allowedDataClasses: ['synthetic'],
    },
  },
};

describe('platform-ops AI provider wiring', () => {
  it('registers no provider and never reads a key when no provider is configured', () => {
    const config = keyConfig('test-only-key');
    const aiRuntime = runtime();

    expect(aiRuntime.configured).toBe(false);
    expect(createAiProviderAdapters(aiRuntime, config)).toEqual([]);
    expect(config.get).not.toHaveBeenCalled();
  });

  it('registers no provider when live use cases are narrowed to none by an unconfigured runtime', () => {
    const config = keyConfig('test-only-key');

    expect(createAiProviderAdapters(runtime({ AI_LIVE_USE_CASES: 'pare.risk' }), config)).toEqual([]);
    expect(config.get).not.toHaveBeenCalled();
  });

  it('registers Anthropic and reads only its key when the Anthropic provider is configured', () => {
    const config = keyConfig('test-only-key');
    const aiRuntime = runtime({ AI_PROVIDER: 'anthropic', AI_ZDR_CONFIRMED: 'true' });

    const adapters = createAiProviderAdapters(aiRuntime, config);

    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toBeInstanceOf(AnthropicProviderAdapter);
    expect(adapters[0]?.provider).toBe('anthropic');
    expect(config.get).toHaveBeenCalledExactlyOnceWith('ANTHROPIC_API_KEY');
  });

  it('rejects a configured Anthropic provider when the key is missing', () => {
    const aiRuntime = runtime({ AI_PROVIDER: 'anthropic', AI_LIVE_USE_CASES: 'pare.risk' });

    expect(() => createAiProviderAdapters(aiRuntime, keyConfig(' ')))
      .toThrow(/ANTHROPIC_API_KEY is required/);
  });

  it('registers OpenRouter for the OpenRouter ZDR profile on its reviewed endpoint policy', () => {
    const config = keyConfig('test-openrouter-key-only', 'OPENROUTER_API_KEY');
    const aiRuntime = runtime({ AI_PROVIDER: 'openrouter' });

    const adapters = createAiProviderAdapters(aiRuntime, config);

    expect(aiRuntime.profileId).toBe('openrouter-zdr');
    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toBeInstanceOf(OpenRouterProviderAdapter);
    expect(adapters[0]?.endpointPolicyId).toBe(AI_ROUTE_PROFILES['openrouter-zdr']!.routesByTier.fast.endpointPolicyId);
    expect(config.get).toHaveBeenCalledExactlyOnceWith('OPENROUTER_API_KEY');
  });

  it('registers OpenRouter for an explicitly enabled synthetic route', () => {
    const config = keyConfig('test-openrouter-key-only', 'OPENROUTER_API_KEY');
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: openRouterTestProfile.id,
      AI_LIVE_USE_CASES: 'pare.risk',
    }, { [openRouterTestProfile.id]: openRouterTestProfile });

    const adapters = createAiProviderAdapters(aiRuntime, config);

    expect(adapters.map((adapter) => adapter.provider)).toEqual(['openrouter']);
    expect(adapters[0]?.endpointPolicyId).toBe('test-upstream');
    expect(config.get).toHaveBeenCalledExactlyOnceWith('OPENROUTER_API_KEY');
  });

  it('fails closed when an enabled OpenRouter route has no key', () => {
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: openRouterTestProfile.id,
      AI_LIVE_USE_CASES: 'pare.risk',
    }, { [openRouterTestProfile.id]: openRouterTestProfile });

    expect(() => createAiProviderAdapters(aiRuntime, keyConfig(undefined, 'OPENROUTER_API_KEY')))
      .toThrow(/OPENROUTER_API_KEY is required/);
  });
});
