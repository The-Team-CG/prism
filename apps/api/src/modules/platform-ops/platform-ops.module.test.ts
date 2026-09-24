import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { resolveAiGatewayRuntimeConfig } from './application/ai-governance/gateway/ai-gateway.config';
import { MockAiProviderAdapter } from './infrastructure/ai-governance/mock-ai-provider.adapter';
import { createAiProviderAdapters } from './platform-ops.module';

function runtime(values: Record<string, string | undefined> = {}) {
  return resolveAiGatewayRuntimeConfig({ get: (key: string) => values[key] });
}

function keyConfig(value?: string) {
  return {
    get: vi.fn((key: string) => key === 'ANTHROPIC_API_KEY' ? value : undefined),
  } as unknown as Pick<ConfigService, 'get'>;
}

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
});
