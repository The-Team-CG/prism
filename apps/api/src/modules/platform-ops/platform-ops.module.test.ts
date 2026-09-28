import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { AiRouteProfile } from '@prism/types';
import { AI_ROUTE_PROFILES, resolveAiGatewayRuntimeConfig } from './application/ai-governance/gateway/ai-gateway.config';
import { MockAiProviderAdapter } from './infrastructure/ai-governance/mock-ai-provider.adapter';
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
  it('keeps mock as the only provider by default without reading the Anthropic key', () => {
    const mockAdapter = new MockAiProviderAdapter();
    const config = keyConfig('test-only-key');

    const adapters = createAiProviderAdapters(mockAdapter, runtime(), config);

    expect(adapters).toEqual([mockAdapter]);
    expect(config.get).not.toHaveBeenCalled();
  });

  it('keeps the Anthropic adapter absent until a test use case is explicitly enabled', () => {
    const mockAdapter = new MockAiProviderAdapter();
    const config = keyConfig();
    const aiRuntime = runtime({ AI_ROUTE_PROFILE: 'test-anthropic' });

    const adapters = createAiProviderAdapters(mockAdapter, aiRuntime, config);

    expect(adapters).toEqual([mockAdapter]);
    expect(config.get).not.toHaveBeenCalled();
  });

  it('registers Anthropic only for enabled test-profile use cases and reads the key there', () => {
    const mockAdapter = new MockAiProviderAdapter();
    const config = keyConfig('test-only-key');
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: 'test-anthropic',
      AI_LIVE_USE_CASES: 'pare.risk',
    });

    const adapters = createAiProviderAdapters(mockAdapter, aiRuntime, config);

    expect(adapters.map((adapter) => adapter.provider)).toEqual(['mock', 'anthropic']);
    expect(config.get).toHaveBeenCalledExactlyOnceWith('ANTHROPIC_API_KEY');
  });

  it('rejects an enabled test route when the key is missing', () => {
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: 'test-anthropic',
      AI_LIVE_USE_CASES: 'pare.risk',
    });

    expect(() => createAiProviderAdapters(new MockAiProviderAdapter(), aiRuntime, keyConfig(' ')))
      .toThrow(/ANTHROPIC_API_KEY is required/);
  });

  it('registers OpenRouter only for an explicitly enabled synthetic route', () => {
    const config = keyConfig('test-openrouter-key-only', 'OPENROUTER_API_KEY');
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: openRouterTestProfile.id,
      AI_LIVE_USE_CASES: 'pare.risk',
    }, { [openRouterTestProfile.id]: openRouterTestProfile });

    const adapters = createAiProviderAdapters(new MockAiProviderAdapter(), aiRuntime, config);

    expect(adapters.map((adapter) => adapter.provider)).toEqual(['mock', 'openrouter']);
    expect(adapters[1]).toBeInstanceOf(OpenRouterProviderAdapter);
    expect(adapters[1]?.endpointPolicyId).toBe('test-upstream');
    expect(config.get).toHaveBeenCalledExactlyOnceWith('OPENROUTER_API_KEY');
  });

  it('fails closed when an enabled OpenRouter route has no key', () => {
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: openRouterTestProfile.id,
      AI_LIVE_USE_CASES: 'pare.risk',
    }, { [openRouterTestProfile.id]: openRouterTestProfile });

    expect(() => createAiProviderAdapters(new MockAiProviderAdapter(), aiRuntime, keyConfig(undefined, 'OPENROUTER_API_KEY')))
      .toThrow(/OPENROUTER_API_KEY is required/);
  });
});
