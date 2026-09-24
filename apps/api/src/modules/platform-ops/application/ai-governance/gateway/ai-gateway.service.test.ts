import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { pareRiskSchema, type AiSyntheticProvenance } from '@prism/types';
import type { PrismaService } from '@prism/kernel/database';
import type { AiProviderAdapter, AiProviderRequest, AiProviderResponse } from '../../../contracts/ai-governance/ai-gateway.port';
import type { AiGatewayRuntimeConfig } from './ai-gateway.config';
import { resolveAiGatewayRuntimeConfig } from './ai-gateway.config';
import { AiGatewayService } from './ai-gateway.service';
import {
  SyntheticFixtureRegistry,
  SYNTHETIC_PARE_CONTEXT_FIXTURE,
  SYNTHETIC_TOOL_RESULT_FIXTURE,
} from './synthetic-fixture-registry';
import { MockAiProviderAdapter } from '../../../infrastructure/ai-governance/mock-ai-provider.adapter';

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

function fakePrisma(options: { allowBudget?: boolean } = {}) {
  const auditRows = new Map<string, Record<string, unknown>>();
  const tx = {
    $queryRaw: vi.fn(async () => options.allowBudget === false ? [] : [{ id: 'budget-row' }]),
    $executeRaw: vi.fn(async () => 1),
    opsAiAuditLog: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = auditRows.get(where.id) ?? {};
        auditRows.set(where.id, { ...row, ...data });
        return row;
      }),
    },
  };
  const prisma = {
    opsAiAuditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditRows.set(String(data.id), data);
        return data;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = auditRows.get(where.id) ?? {};
        auditRows.set(where.id, { ...row, ...data });
        return row;
      }),
    },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return { prisma: prisma as unknown as PrismaService, tx, audits: auditRows };
}

function runtime(values: Record<string, string | undefined> = {}): AiGatewayRuntimeConfig {
  return resolveAiGatewayRuntimeConfig(config(values));
}

function gateway(
  prisma: PrismaService,
  aiRuntime: AiGatewayRuntimeConfig = runtime(),
  adapter: AiProviderAdapter = new MockAiProviderAdapter(),
  syntheticVerifier: { verify(input: unknown): Promise<AiSyntheticProvenance | null> } = new SyntheticFixtureRegistry(),
) {
  const mockAdapter = new MockAiProviderAdapter();
  return new AiGatewayService(
    prisma,
    aiRuntime,
    adapter.provider === 'mock' ? [adapter] : [mockAdapter, adapter],
    syntheticVerifier,
  );
}

class CountingAnthropicAdapter implements AiProviderAdapter {
  readonly provider = 'anthropic' as const;
  run = vi.fn(async (_request: AiProviderRequest): Promise<AiProviderResponse> => ({
    text: '{"level":"LOW","factors":[],"recommendation":"Review"}',
    toolCalls: [],
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 8 },
  }));
  async *stream(request: AiProviderRequest): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
    yield { type: 'final', response: await this.run(request) };
  }
}

describe('AI gateway core', () => {
  it('defaults to the mock profile and rejects live routes with invalid configuration', () => {
    expect(runtime().profileId).toBe('mock');
    expect(runtime().liveUseCases.size).toBe(0);
    expect(runtime({ AI_ROUTE_PROFILE: 'openrouter' }).profileId).toBe('mock');
    expect(() => runtime({ AI_ROUTE_PROFILE: 'openrouter', AI_LIVE_USE_CASES: 'pare.risk', ANTHROPIC_API_KEY: 'configured' })).toThrow(/Unsupported AI_ROUTE_PROFILE/);
    expect(runtime({ AI_ROUTE_PROFILE: 'test-anthropic', AI_LIVE_USE_CASES: 'comms.draft' }).profileId).toBe('test-anthropic');
    expect(() => runtime({ AI_ROUTE_PROFILE: 'test-anthropic', AI_LIVE_USE_CASES: 'pare.unknown', ANTHROPIC_API_KEY: 'configured' })).toThrow(/Unsupported AI live use case/);
    expect(runtime({ AI_ROUTE_PROFILE: 'test-anthropic', NODE_ENV: 'production' }).profileId).toBe('mock');
    expect(() => runtime({ AI_ROUTE_PROFILE: 'test-anthropic', AI_LIVE_USE_CASES: 'pare.risk', ANTHROPIC_API_KEY: 'configured', NODE_ENV: 'production' })).toThrow(/disabled in production/);
  });

  it('runs mock calls through validated output, usage reservation, and one audit outcome', async () => {
    const { prisma, tx, audits } = fakePrisma();
    const adapter = new MockAiProviderAdapter();
    const run = vi.spyOn(adapter, 'run');
    const service = gateway(prisma, runtime(), adapter);
    service.onModuleInit();

    const result = await service.run('pare.budget', SYNTHETIC_PARE_CONTEXT_FIXTURE);

    expect(result.outcome).toBe('completed');
    expect(result.outcome === 'completed' && result.output.selectedCandidate.supplierName).toBe('Supplier X');
    expect(run).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(audits.size).toBe(1);
    const audit = [...audits.values()][0];
    expect(audit.featureName).toBe('pare.budget');
    expect(audit.modelVersion).toBe('mock-v1');
    expect(audit.outcome).toBe('completed');
    expect(audit.status).toBe('completed');
    expect(audit.zdrConfirmed).toBe(false);
    expect(audit.inputTokens).toBeGreaterThan(0);
    expect(audit.sanitizedPayload).toEqual(SYNTHETIC_PARE_CONTEXT_FIXTURE);
  });

  it('blocks unverified real PARE input before calling Anthropic and records attempted data classes', async () => {
    const { prisma, audits } = fakePrisma();
    const adapter = new CountingAnthropicAdapter();
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: 'test-anthropic',
      AI_LIVE_USE_CASES: 'pare.risk',
      ANTHROPIC_API_KEY: 'configured',
    });
    const service = gateway(prisma, aiRuntime, adapter);
    service.onModuleInit();

    const result = await service.run('pare.risk', {
      ...SYNTHETIC_PARE_CONTEXT_FIXTURE,
      clientName: 'Real Person',
      eventName: 'Jane Smith Wedding',
      clientPreferences: ['Jane Smith <jane@example.org>'],
      budgetAnalysis: {
        feasible: true,
        selectedCandidate: {
          supplierId: 'supplier-record-7',
          supplierName: 'Jane Smith',
          tier: 'premium',
          quotedAmount: 5_000,
          reliabilityScore: 0.9,
          halal: true,
          priorPmcmEvents: 2,
          reason: 'Jane Smith at 123 Main Street',
        },
        costDelta: 0,
        costDeltaLabel: 'Jane Smith at 123 Main Street',
        summary: 'Call Jane at 123 Main Street',
      },
    });

    expect(result.outcome).toBe('blocked');
    expect(result.outcome === 'blocked' && result.error.code).toBe('synthetic_provenance_required');
    expect(adapter.run).not.toHaveBeenCalled();
    const audit = [...audits.values()][0];
    expect(audit.outcome).toBe('blocked');
    expect(audit.dataCategories).toEqual(['internal', 'personal']);
    expect(JSON.stringify(audit.sanitizedPayload)).not.toContain('Real Person');
    expect(JSON.stringify(audit.sanitizedPayload)).not.toContain('Jane Smith');
    expect(JSON.stringify(audit.sanitizedPayload)).not.toContain('jane@example.org');
    expect(JSON.stringify(audit.sanitizedPayload)).not.toContain('123 Main Street');
    expect(JSON.stringify(audit.sanitizedPayload)).not.toContain('supplier-record-7');
    expect(JSON.stringify(audit.sanitizedPayload)).toContain('[identifier redacted]');
    expect(audit.syntheticProvenance).toBe(Prisma.DbNull);
  });

  it('keeps Anthropic disabled when the explicit live-use-case allowlist is empty', async () => {
    const { prisma } = fakePrisma();
    const adapter = new CountingAnthropicAdapter();
    const aiRuntime = runtime({ AI_ROUTE_PROFILE: 'test-anthropic', ANTHROPIC_API_KEY: 'configured' });
    const service = gateway(prisma, aiRuntime, adapter);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE);

    expect(result.outcome).toBe('blocked');
    expect(result.outcome === 'blocked' && result.error.code).toBe('use_case_disabled');
    expect(adapter.run).not.toHaveBeenCalled();
  });

  it('continues Anthropic synthetic tool loops only with registered synthetic results', async () => {
    const { prisma, audits } = fakePrisma();
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'anthropic' as const;
      run = vi.fn(async (request: AiProviderRequest): Promise<AiProviderResponse> => {
        if (request.messages.some((message) => message.role === 'tool')) {
          return {
            text: '{"level":"LOW","factors":[],"recommendation":"Review"}',
            toolCalls: [],
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 8 },
            responseModel: 'claude-sonnet-4-6',
          };
        }
        return {
          text: '',
          toolCalls: [{
            id: 'tool-call-1',
            name: 'lookup',
            input: { level: 'LOW', factors: [], recommendation: 'Check' },
          }],
          stopReason: 'tool_use',
          usage: { inputTokens: 10, outputTokens: 5 },
          responseModel: 'claude-sonnet-4-6',
        };
      });
      async *stream(request: AiProviderRequest): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run(request) };
      }
    }();
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: 'test-anthropic',
      AI_LIVE_USE_CASES: 'pare.risk',
      ANTHROPIC_API_KEY: 'configured',
    });
    const service = gateway(prisma, aiRuntime, adapter);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE, {
      tools: [{
        name: 'lookup',
        description: 'Synthetic lookup',
        inputSchema: pareRiskSchema,
        execute: async () =>
          '{"status":"synthetic-result-v1","message":"Jane Smith at 123 Main Street","message":"Synthetic tool result"}',
      }],
    });

    expect(result.outcome).toBe('completed');
    expect(adapter.run).toHaveBeenCalledTimes(2);
    const toolMessage = adapter.run.mock.calls[1][0].messages.find((message) => message.role === 'tool');
    expect(toolMessage?.role).toBe('tool');
    if (toolMessage?.role === 'tool') {
      expect(toolMessage.toolResults[0].content).toBe(
        '{"message":"Synthetic tool result","status":"synthetic-result-v1"}',
      );
      expect(toolMessage.toolResults[0].content).not.toContain('Jane Smith');
      expect(toolMessage.toolResults[0].content).not.toContain('Main Street');
    }
    expect([...audits.values()][0].outcome).toBe('completed');
  });

  it('blocks an Anthropic tool result that is not a registered synthetic fixture', async () => {
    const { prisma } = fakePrisma();
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'anthropic' as const;
      run = vi.fn(async (): Promise<AiProviderResponse> => ({
        text: '',
        toolCalls: [{
          id: 'tool-call-1',
          name: 'lookup',
          input: { level: 'LOW', factors: [], recommendation: 'Check' },
        }],
        stopReason: 'tool_use',
        usage: { inputTokens: 10, outputTokens: 5 },
      }));
      async *stream(_request: AiProviderRequest): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run() };
      }
    }();
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: 'test-anthropic',
      AI_LIVE_USE_CASES: 'pare.risk',
      ANTHROPIC_API_KEY: 'configured',
    });
    const service = gateway(prisma, aiRuntime, adapter);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE, {
      tools: [{
        name: 'lookup',
        description: 'Synthetic lookup',
        inputSchema: pareRiskSchema,
        execute: async () => JSON.stringify({ message: 'unregistered result' }),
      }],
    });

    expect(result.outcome).toBe('blocked');
    expect(result.outcome === 'blocked' && result.error.code).toBe('synthetic_provenance_required');
    expect(adapter.run).toHaveBeenCalledOnce();
  });

  it('fails closed and records an audit if synthetic-provenance verification fails', async () => {
    const { prisma, audits } = fakePrisma();
    const adapter = new CountingAnthropicAdapter();
    const aiRuntime = runtime({
      AI_ROUTE_PROFILE: 'test-anthropic',
      AI_LIVE_USE_CASES: 'pare.risk',
      ANTHROPIC_API_KEY: 'configured',
    });
    const verifier = { verify: async () => { throw new Error('fixture registry unavailable'); } };
    const service = gateway(prisma, aiRuntime, adapter, verifier);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE);

    expect(result.outcome).toBe('blocked');
    expect(result.outcome === 'blocked' && result.error.code).toBe('synthetic_provenance_required');
    expect(adapter.run).not.toHaveBeenCalled();
    expect([...audits.values()][0].outcome).toBe('blocked');
  });

  it('does not reach the provider after the daily reservation is denied', async () => {
    const { prisma } = fakePrisma({ allowBudget: false });
    const adapter = new MockAiProviderAdapter();
    const run = vi.spyOn(adapter, 'run');
    const service = gateway(prisma, runtime(), adapter);

    const result = await service.run('pare.budget', SYNTHETIC_PARE_CONTEXT_FIXTURE);

    expect(result.outcome).toBe('unavailable');
    expect(run).not.toHaveBeenCalled();
  });

  it('fails closed when provider usage exceeds the requested output bound', async () => {
    const { prisma, audits } = fakePrisma();
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'mock' as const;
      async run(request: AiProviderRequest): Promise<AiProviderResponse> {
        return {
          text: '{"level":"LOW","factors":[],"recommendation":"Review"}',
          toolCalls: [],
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: request.maxOutputTokens + 1 },
        };
      }
      async *stream(request: AiProviderRequest): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run(request) };
      }
    }();
    const service = gateway(prisma, runtime(), adapter);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE);

    expect(result.outcome).toBe('failed');
    expect(result.outcome === 'failed' && result.error.code).toBe('provider_rejected');
    expect([...audits.values()][0].outputTokens).toBe(901);
  });

  it('retries only on the selected adapter and reconciles each physical attempt', async () => {
    const { prisma, tx } = fakePrisma();
    let attempts = 0;
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'mock' as const;
      async run(): Promise<AiProviderResponse> {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error('temporary provider failure') as Error & { retryable: true };
          error.retryable = true;
          throw error;
        }
        return {
          text: '{"level":"LOW","factors":[],"recommendation":"Review"}',
          toolCalls: [],
          stopReason: 'end_turn',
          usage: { inputTokens: 12, outputTokens: 8 },
          responseModel: 'mock-v1',
        };
      }
      async *stream(): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run() };
      }
    }();
    const service = gateway(prisma, runtime(), adapter);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE);

    expect(result.outcome).toBe('completed');
    expect(attempts).toBe(3);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('returns incomplete after exhausting the tool-step limit', async () => {
    const { prisma } = fakePrisma();
    const execute = vi.fn(async () => 'safe synthetic tool result');
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'mock' as const;
      async run(): Promise<AiProviderResponse> {
        return {
          text: '',
          toolCalls: [{ id: 'tool-call-1', name: 'lookup', input: { level: 'LOW', factors: [], recommendation: 'Check' } }],
          stopReason: 'tool_use',
          usage: { inputTokens: 4, outputTokens: 2 },
        };
      }
      async *stream(): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run() };
      }
    }();
    const service = gateway(prisma, runtime(), adapter);
    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE, {
      tools: [{
        name: 'lookup',
        description: 'Synthetic lookup',
        inputSchema: pareRiskSchema,
        execute,
      }],
    });

    expect(result.outcome).toBe('incomplete');
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('rejects duplicate provider tool-call IDs before invoking handlers', async () => {
    const { prisma } = fakePrisma();
    const execute = vi.fn(async () => 'safe result');
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'mock' as const;
      async run(): Promise<AiProviderResponse> {
        return {
          text: '',
          toolCalls: [
            { id: 'duplicate-call', name: 'lookup', input: { level: 'LOW', factors: [], recommendation: 'Check' } },
            { id: 'duplicate-call', name: 'lookup', input: { level: 'LOW', factors: [], recommendation: 'Check' } },
          ],
          stopReason: 'tool_use',
          usage: { inputTokens: 4, outputTokens: 2 },
        };
      }
      async *stream(): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run() };
      }
    }();
    const service = gateway(prisma, runtime(), adapter);

    const result = await service.run('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE, {
      tools: [{
        name: 'lookup',
        description: 'Synthetic lookup',
        inputSchema: pareRiskSchema,
        execute,
      }],
    });

    expect(result.outcome).toBe('failed');
    expect(result.outcome === 'failed' && result.error.code).toBe('invalid_tool_call');
    expect(execute).not.toHaveBeenCalled();
  });

  it('records caller aborts and does not call the provider', async () => {
    const { prisma } = fakePrisma();
    const adapter = new MockAiProviderAdapter();
    const run = vi.spyOn(adapter, 'run');
    const service = gateway(prisma, runtime(), adapter);
    const controller = new AbortController();
    controller.abort();

    const result = await service.run('pare.budget', SYNTHETIC_PARE_CONTEXT_FIXTURE, { signal: controller.signal });

    expect(result.outcome).toBe('aborted');
    expect(run).not.toHaveBeenCalled();
  });

  it('validates final output before emitting stream deltas', async () => {
    const { prisma } = fakePrisma();
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'mock' as const;
      async run(): Promise<AiProviderResponse> {
        return { text: '{"unexpected":true}', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 2 } };
      }
      async *stream(): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run() };
      }
    }();
    const service = gateway(prisma, runtime(), adapter);
    const events = [];
    for await (const event of service.stream('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE)) events.push(event);

    expect(events.map((event) => event.type)).toEqual(['meta', 'failure']);
    expect(events[1].type === 'failure' && events[1].result.error.code).toBe('invalid_output');
  });

  it('aborts and audits provider work when a stream consumer disconnects', async () => {
    const { prisma, audits } = fakePrisma();
    let capturedSignal: AbortSignal | undefined;
    let markProviderStarted!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    const adapter = new class implements AiProviderAdapter {
      readonly provider = 'mock' as const;
      run = vi.fn(async (_request: AiProviderRequest, signal?: AbortSignal) => {
        capturedSignal = signal;
        markProviderStarted();
        return new Promise<AiProviderResponse>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      });
      async *stream(request: AiProviderRequest, signal?: AbortSignal): AsyncIterable<{ type: 'final'; response: AiProviderResponse }> {
        yield { type: 'final', response: await this.run(request, signal) };
      }
    }();
    const service = gateway(prisma, runtime(), adapter);
    const iterator = service.stream('pare.risk', SYNTHETIC_PARE_CONTEXT_FIXTURE)[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.value?.type).toBe('meta');
    await providerStarted;
    if (!iterator.return) throw new Error('The AI stream must support cancellation');
    await iterator.return();

    expect(capturedSignal?.aborted).toBe(true);
    expect([...audits.values()][0].outcome).toBe('aborted');
  });
});
