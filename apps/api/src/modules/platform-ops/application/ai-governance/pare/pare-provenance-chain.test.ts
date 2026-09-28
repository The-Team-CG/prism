import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import type {
  AiProviderAdapter,
  AiProviderRequest,
  AiProviderResponse,
} from '../../../contracts/ai-governance/ai-gateway.port';
import { resolveAiGatewayRuntimeConfig } from '../gateway/ai-gateway.config';
import { AiGatewayService } from '../gateway/ai-gateway.service';
import {
  SyntheticFixtureRegistry,
  SYNTHETIC_PARE_CHAIN_ROOT_FIXTURE,
  SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE,
} from '../gateway/synthetic-fixture-registry';
import { MockAiProviderAdapter } from '../../../infrastructure/ai-governance/mock-ai-provider.adapter';
import { BudgetAgent } from './agents/budget.agent';
import { EventContextAgent } from './agents/event-context.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { PAREService } from './pare.service';
import type { PAREContext } from './pare.types';

type StoredRow = { id: string; [key: string]: unknown };
type Stage = 'pare.budget' | 'pare.risk' | 'pare.message-drafts';
type Provider = 'anthropic' | 'mock';

const outputs = {
  'pare.budget': SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE.budgetAnalysis,
  'pare.risk': SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE.riskAssessment,
  'pare.message-drafts': {
    supplierNotification: 'Synthetic supplier message for PMCM review.',
    clientReassurance: 'Synthetic client message for PMCM review.',
  },
} satisfies Record<Stage, unknown>;

class ScriptedPareAdapter implements AiProviderAdapter {
  readonly provider: Provider;
  readonly endpointPolicyId: string;
  readonly requests: { useCaseId: Stage; request: AiProviderRequest }[] = [];

  constructor(provider: Provider) {
    this.provider = provider;
    this.endpointPolicyId = provider === 'anthropic' ? 'anthropic-direct' : 'deterministic-mock';
  }

  async run(request: AiProviderRequest, signal?: AbortSignal): Promise<AiProviderResponse> {
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');
    const useCaseId = (request.systemPrompt.match(/Use case: (pare\.[a-z-]+)/)?.[1] ?? 'pare.budget') as Stage;
    this.requests.push({ useCaseId, request: structuredClone(request) });
    const hasToolResults = request.messages.some((message) => message.role === 'tool');
    return {
      text: hasToolResults ? JSON.stringify(outputs[useCaseId]) : '',
      toolCalls: hasToolResults ? [] : [{
        id: `${useCaseId}-lookup`,
        name: useCaseId === 'pare.budget'
          ? 'get_event_budget_summary'
          : useCaseId === 'pare.risk' ? 'get_supplier_history' : 'get_event_and_replacement_summary',
        input: useCaseId === 'pare.risk' ? { supplierName: 'Supplier Y' } : {},
      }],
      stopReason: hasToolResults ? 'end_turn' : 'tool_use',
      usage: { inputTokens: 10, outputTokens: 12 },
      responseModel: request.model,
      endpointTag: this.endpointPolicyId,
    };
  }

  async *stream(request: AiProviderRequest, signal?: AbortSignal) {
    yield { type: 'final' as const, response: await this.run(request, signal) };
  }
}

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

function createPrismaHarness() {
  const state = { audits: [] as StoredRow[], approvals: [] as StoredRow[] };
  const createModel = (rows: StoredRow[]) => ({
    create: vi.fn(async ({ data }: { data: StoredRow }) => {
      const row = structuredClone(data);
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((entry) => entry.id === where.id);
      if (!row) throw new Error(`Missing row ${where.id}`);
      Object.assign(row, data);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const matches = rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
      matches.forEach((row) => Object.assign(row, data));
      return { count: matches.length };
    }),
    findUnique: vi.fn(async ({ where }: { where: { id?: string; sourceDispatchId?: string } }) =>
      rows.find((row) => (where.id ? row.id === where.id : row.sourceDispatchId === where.sourceDispatchId)) ?? null),
    findMany: vi.fn(async ({ where }: { where?: { id?: { in?: string[] } } } = {}) =>
      where?.id?.in ? rows.filter((row) => where.id!.in!.includes(row.id)) : rows),
  });
  const auditModel = createModel(state.audits);
  const approvalModel = createModel(state.approvals);
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'daily-token-budget' }]),
    $executeRaw: vi.fn(async () => 1),
    opsAiAuditLog: auditModel,
    opsAiApprovalRecord: approvalModel,
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(work: (client: typeof tx) => Promise<T>) => work(tx)),
  };
  return { prisma: prisma as unknown as PrismaService, state };
}

function createRuntime(provider: Provider) {
  return provider === 'anthropic'
    ? resolveAiGatewayRuntimeConfig(config({
        AI_ROUTE_PROFILE: 'test-anthropic',
        AI_LIVE_USE_CASES: 'pare.budget,pare.risk,pare.message-drafts',
        ANTHROPIC_API_KEY: 'configured-for-test',
        NODE_ENV: 'test',
      }))
    : resolveAiGatewayRuntimeConfig(config({ NODE_ENV: 'test' }));
}

function setup(provider: Provider) {
  vi.stubEnv('PARE_MODE', 'live');
  const root = structuredClone(SYNTHETIC_PARE_CHAIN_ROOT_FIXTURE) as PAREContext;
  vi.spyOn(EventContextAgent.prototype, 'buildPareEventContext').mockResolvedValue(root);
  vi.spyOn(SupplierFinderAgent.prototype, 'findPareSupplierCandidates').mockResolvedValue(root.candidates ?? []);

  const { prisma, state } = createPrismaHarness();
  const adapter = new ScriptedPareAdapter(provider);
  const registry = new SyntheticFixtureRegistry();
  const runtime = createRuntime(provider);
  const gateway = new AiGatewayService(prisma, runtime, [new MockAiProviderAdapter(), adapter], registry);
  gateway.onModuleInit();
  const service = new PAREService(prisma, undefined, gateway, undefined, registry);
  return { root, prisma, state, adapter, registry, gateway, service };
}

describe('PARE provenance chain', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(['mock', 'anthropic'] as const)(
    'runs the complete ordered synthetic emergency through %s tool loops and leaves drafts for PMCM review',
    async (provider) => {
      const { root, state, adapter, service } = setup(provider);
      const pending = await service.handleEmergencyTrigger(root.triggerId);

      expect(pending.status).toBe('pending');
      expect(pending.pareResult.drafts).toEqual(outputs['pare.message-drafts']);
      expect(adapter.requests.map(({ useCaseId }) => useCaseId)).toEqual([
        'pare.budget', 'pare.budget',
        'pare.risk', 'pare.risk',
        'pare.message-drafts', 'pare.message-drafts',
      ]);
      expect(adapter.requests.find(({ useCaseId }) => useCaseId === 'pare.risk')?.request.messages[0])
        .toMatchObject({ role: 'user', content: expect.stringContaining('budgetAnalysis') });
      expect(adapter.requests.find(({ useCaseId }) => useCaseId === 'pare.message-drafts')?.request.messages[0])
        .toMatchObject({ role: 'user', content: expect.stringContaining('riskAssessment') });

      const gatewayAudits = state.audits.filter((row) => row.useCaseId);
      expect(gatewayAudits).toHaveLength(3);
      const chains = gatewayAudits.map((row) => (row.sanitizedPayload as Record<string, unknown>)._aiPareChain);
      expect(chains).toEqual([
        expect.objectContaining({ stage: 'pare.budget', stageIndex: 0, toolResultDigests: expect.any(Array) }),
        expect.objectContaining({ stage: 'pare.risk', stageIndex: 1, priorAuditIds: [gatewayAudits[0].id] }),
        expect.objectContaining({ stage: 'pare.message-drafts', stageIndex: 2, priorAuditIds: [gatewayAudits[0].id, gatewayAudits[1].id] }),
      ]);
      const pareAudit = state.audits.find((row) => row.featureName === 'PARE');
      expect(pareAudit?.sanitizedPayload).not.toHaveProperty('drafts');
      expect(pareAudit?.sanitizedPayload).not.toHaveProperty('clientReassurance');
      expect(pareAudit?.sanitizedPayload).toHaveProperty('runEvidence');
      expect(state.approvals[0]?.reviewPayload).toMatchObject({ drafts: outputs['pare.message-drafts'] });
      expect(state.approvals[0]?.status).toBe('pending_human_approval');
      expect(state.audits.some((row) => row.featureName === 'notification' || row.featureName === 'outbox')).toBe(false);
    },
  );

  it('blocks a changed budget output before the risk provider call', async () => {
    const { root, adapter, service } = setup('anthropic');
    const original = BudgetAgent.prototype.runPareBudgetAgent;
    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async function (this: BudgetAgent, ctx, signal, chain) {
      const result = await original.call(this, ctx, signal, chain);
      return { ...result, output: { ...result.output, summary: 'tampered after budget completion' } };
    });

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'blocked', code: 'synthetic_provenance_required',
    });
    expect(adapter.requests.map(({ useCaseId }) => useCaseId)).toEqual(['pare.budget', 'pare.budget']);
  });

  it('blocks a changed correlation ID before the risk provider call', async () => {
    const { root, adapter, service } = setup('anthropic');
    const original = BudgetAgent.prototype.runPareBudgetAgent;
    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async function (this: BudgetAgent, ctx, signal, chain) {
      const result = await original.call(this, ctx, signal, chain);
      ctx.triggerId = 'tampered-correlation';
      return result;
    });

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'blocked', code: 'synthetic_provenance_required',
    });
    expect(adapter.requests.map(({ useCaseId }) => useCaseId)).toEqual(['pare.budget', 'pare.budget']);
  });

  it('blocks a mutated tool result before the provider can continue its tool loop', async () => {
    const { root, adapter, registry, service } = setup('anthropic');
    const verify = registry.verify.bind(registry);
    vi.spyOn(registry, 'verify').mockImplementation(async (input) => {
      if (input && typeof input === 'object' && !('triggerId' in input)) return null;
      return verify(input);
    });

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'blocked', code: 'synthetic_provenance_required',
    });
    expect(adapter.requests.map(({ useCaseId }) => useCaseId)).toEqual(['pare.budget']);
  });

  it('blocks a changed durable prior audit outcome before the risk provider call', async () => {
    const { root, adapter, state, service } = setup('anthropic');
    const original = BudgetAgent.prototype.runPareBudgetAgent;
    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async function (this: BudgetAgent, ctx, signal, chain) {
      const result = await original.call(this, ctx, signal, chain);
      const budgetAudit = state.audits.find((row) => row.useCaseId === 'pare.budget');
      if (budgetAudit) budgetAudit.outcome = 'failed';
      return result;
    });

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'blocked', code: 'synthetic_provenance_required',
    });
    expect(adapter.requests.map(({ useCaseId }) => useCaseId)).toEqual(['pare.budget', 'pare.budget']);
  });

  it('allows PMCM approval only while every completed stage audit still matches the chain', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const approved = await service.approveRecommendation(pending.id, 'pmcm-reviewer');

    expect(approved.status).toBe('approved');
    expect(state.audits.find((row) => row.featureName === 'PARE')?.status).toBe('approved');
    expect(approved.pareResult.drafts).toEqual(outputs['pare.message-drafts']);
  });

  it('rejects PMCM approval if a completed stage audit was changed after the run', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const budgetAudit = state.audits.find((row) => row.useCaseId === 'pare.budget');
    if (budgetAudit) budgetAudit.outcome = 'failed';

    await expect(service.approveRecommendation(pending.id, 'pmcm-reviewer'))
      .rejects.toThrow(/matching durable completed PARE stage audit/i);
    expect(state.approvals[0]?.status).toBe('pending_human_approval');
  });

  it('rejects PMCM approval if the saved review payload no longer matches its audit digest', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const savedPayload = state.approvals[0]?.reviewPayload as Record<string, unknown>;
    (savedPayload.drafts as Record<string, unknown>).clientReassurance = 'changed after generation';

    await expect(service.approveRecommendation(pending.id, 'pmcm-reviewer'))
      .rejects.toThrow(/review payload does not match its audited digest/i);
    expect(state.approvals[0]?.status).toBe('pending_human_approval');
  });

  it('rejects a root fixture that is not registered before any provider call', async () => {
    const { root, adapter, service } = setup('anthropic');
    root.eventName = 'unregistered emergency';

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toThrow(/registered synthetic provenance-chain root/i);
    expect(adapter.requests).toHaveLength(0);
  });
});
