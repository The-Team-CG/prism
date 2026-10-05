import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import type { PlatformReferenceReadModel } from '@prism/contexts/read-models';
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
import { MessageDrafterAgent } from './agents/message-drafter.agent';
import { RiskAgent } from './agents/risk.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { PAREService } from './pare.service';
import type { PAREContext } from './pare.types';

type StoredRow = { id: string; [key: string]: unknown };
type Stage = 'pare.budget' | 'pare.risk' | 'pare.message-drafts';
type Provider = 'anthropic' | 'mock';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

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
    $queryRaw: vi.fn(async (query: unknown, ...values: unknown[]) => {
      const sql = Array.isArray(query)
        ? query.join(' ')
        : query && typeof query === 'object' && 'sql' in query && typeof query.sql === 'string'
          ? query.sql
          : '';
      if (sql.includes('::jsonb::text')) {
        return [{ canonicalPayload: JSON.stringify(JSON.parse(String(values[0]))) }];
      }
      if (sql.includes('review_payload')) {
        const approval = state.approvals.find((row) => row.id === values[0]);
        return approval ? [{ canonicalPayload: JSON.stringify(approval.reviewPayload) }] : [];
      }
      return [{ id: 'daily-token-budget' }];
    }),
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
  const platformReferences: PlatformReferenceReadModel = {
    findStorageEventScope: async () => null,
    findEventReference: async () => null,
    findPrivacyInventory: async () => ({ events: [], approvalRequests: [] }),
    findPareEventSource: async (requestId) => ({
      request: {
        id: requestId,
        eventId: root.eventId,
        assignmentStatus: 'withdrawn',
        supplierId: root.withdrawnSupplier.id,
        supplierName: root.withdrawnSupplier.name,
        category: root.withdrawnSupplier.category,
        supplierTier: root.withdrawnSupplier.tier,
      },
      event: {
        id: root.eventId,
        eventDate: new Date(`${root.eventDate}T00:00:00.000Z`),
        eventName: root.eventName,
        clientName: root.clientName,
      },
      selectedQuotes: [{ requestId, amount: root.withdrawnSupplier.quotedAmount }],
      latestBriefingRequirements: null,
    }),
    findPareSupplierCandidates: async () => [],
    findApprovedTrustRecipientEmail: async () => null,
  };
  const service = new PAREService(prisma, undefined, gateway, undefined, registry, platformReferences);
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
      expect(adapter.requests.filter(({ useCaseId }) => useCaseId === 'pare.budget')).toHaveLength(2);
      expect(adapter.requests.filter(({ useCaseId }) => useCaseId === 'pare.risk')).toHaveLength(2);
      expect(adapter.requests.filter(({ useCaseId }) => useCaseId === 'pare.message-drafts')).toHaveLength(2);
      expect(adapter.requests.find(({ useCaseId }) => useCaseId === 'pare.risk')?.request.messages[0])
        .toMatchObject({ role: 'user', content: expect.not.stringContaining('budgetAnalysis') });
      expect(adapter.requests.find(({ useCaseId }) => useCaseId === 'pare.message-drafts')?.request.messages[0])
        .toMatchObject({ role: 'user', content: expect.stringContaining('budgetAnalysis') });
      expect(adapter.requests.find(({ useCaseId }) => useCaseId === 'pare.message-drafts')?.request.messages[0])
        .toMatchObject({ role: 'user', content: expect.stringContaining('riskAssessment') });

      const gatewayAudits = state.audits.filter((row) => row.useCaseId);
      expect(gatewayAudits).toHaveLength(3);
      const auditsByStage = new Map(gatewayAudits.map((row) => [row.useCaseId, row]));
      const chainsByStage = new Map(gatewayAudits.map((row) => [
        (row.sanitizedPayload as Record<string, unknown>)._aiPareChain &&
          ((row.sanitizedPayload as Record<string, unknown>)._aiPareChain as Record<string, unknown>).stage,
        (row.sanitizedPayload as Record<string, unknown>)._aiPareChain as Record<string, unknown>,
      ]));
      const budgetAudit = auditsByStage.get('pare.budget')!;
      const riskAudit = auditsByStage.get('pare.risk')!;
      expect(chainsByStage.get('pare.budget')).toEqual(expect.objectContaining({
        stage: 'pare.budget', stageIndex: 0, priorAuditIds: [], toolResultDigests: expect.any(Array),
      }));
      expect(chainsByStage.get('pare.risk')).toEqual(expect.objectContaining({
        stage: 'pare.risk', stageIndex: 0, priorAuditIds: [], priorOutputDigests: [],
      }));
      expect(chainsByStage.get('pare.message-drafts')).toEqual(expect.objectContaining({
        stage: 'pare.message-drafts', stageIndex: 2,
        priorAuditIds: [budgetAudit.id, riskAudit.id],
        priorOutputDigests: [
          (chainsByStage.get('pare.budget') as Record<string, unknown>).outputDigest,
          (chainsByStage.get('pare.risk') as Record<string, unknown>).outputDigest,
        ],
      }));
      const pareAudit = state.audits.find((row) => row.featureName === 'PARE');
      expect(pareAudit?.sanitizedPayload).not.toHaveProperty('drafts');
      expect(pareAudit?.sanitizedPayload).not.toHaveProperty('clientReassurance');
      expect(pareAudit?.sanitizedPayload).toHaveProperty('runEvidence');
      expect(state.approvals[0]?.reviewPayload).toMatchObject({ drafts: outputs['pare.message-drafts'] });
      expect(state.approvals[0]?.status).toBe('pending_human_approval');
      expect(state.audits.some((row) => row.featureName === 'notification' || row.featureName === 'outbox')).toBe(false);
    },
  );

  it('starts budget and risk from the same root context and waits for both before drafting', async () => {
    const { root, service } = setup('anthropic');
    const budgetGate = deferred();
    const riskGate = deferred();
    const budgetStarted = deferred<PAREContext>();
    const riskStarted = deferred<PAREContext>();
    const budgetCompleted = deferred();
    const riskCompleted = deferred();
    let riskStartedBeforeBudgetRelease = false;
    const budgetOriginal = BudgetAgent.prototype.runPareBudgetAgent;
    const riskOriginal = RiskAgent.prototype.runPareRiskAgent;
    const draftSpy = vi.spyOn(MessageDrafterAgent.prototype, 'runPareMessageDraftAgent');

    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async function (this: BudgetAgent, ctx, signal, chain) {
      budgetStarted.resolve(ctx);
      await budgetGate.promise;
      const result = await budgetOriginal.call(this, ctx, signal, chain);
      budgetCompleted.resolve();
      return result;
    });
    vi.spyOn(RiskAgent.prototype, 'runPareRiskAgent').mockImplementation(async function (this: RiskAgent, ctx, signal, chain) {
      riskStartedBeforeBudgetRelease = !budgetGateResolved;
      riskStarted.resolve(ctx);
      await riskGate.promise;
      const result = await riskOriginal.call(this, ctx, signal, chain);
      riskCompleted.resolve();
      return result;
    });

    let budgetGateResolved = false;
    const run = service.handleEmergencyTrigger(root.triggerId);
    const settledRun = run.catch((error: unknown) => error);
    const budgetContext = await budgetStarted.promise;
    const rootContextUnchanged = !('budgetAnalysis' in budgetContext) && !('riskAssessment' in budgetContext);

    budgetGateResolved = true;
    budgetGate.resolve();
    const riskContext = await riskStarted.promise;
    expect(budgetContext).toBe(riskContext);
    expect(rootContextUnchanged).toBe(true);
    expect(riskStartedBeforeBudgetRelease).toBe(true);

    await budgetCompleted.promise;
    expect(draftSpy).not.toHaveBeenCalled();
    riskGate.resolve();
    await riskCompleted.promise;

    const result = await settledRun;
    expect(result).toMatchObject({ status: 'pending' });
    expect(draftSpy).toHaveBeenCalledTimes(1);
  });

  it('aborts and awaits the sibling stage before rejecting, without starting drafts', async () => {
    const { root, service } = setup('anthropic');
    const budgetFailure = new Error('budget stage failed');
    const budgetStarted = deferred();
    const riskSawAbort = deferred();
    const releaseRisk = deferred();
    let riskStartedBeforeBudgetFailure = false;
    const draftSpy = vi.spyOn(MessageDrafterAgent.prototype, 'runPareMessageDraftAgent');

    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async () => {
      budgetStarted.resolve();
      await releaseBudget.promise;
      throw budgetFailure;
    });
    vi.spyOn(RiskAgent.prototype, 'runPareRiskAgent').mockImplementation(async function (_ctx, signal) {
      riskStartedBeforeBudgetFailure = true;
      if (signal?.aborted) riskSawAbort.resolve();
      else signal?.addEventListener('abort', () => riskSawAbort.resolve(), { once: true });
      await releaseRisk.promise;
      throw new Error('risk sibling settled after cancellation');
    });

    let settled = false;
    const releaseBudget = deferred();
    const run = service.handleEmergencyTrigger(root.triggerId);
    void run.then(() => { settled = true; }, () => { settled = true; });
    try {
      await budgetStarted.promise;
      await Promise.resolve();
      const siblingStartedInParallel = riskStartedBeforeBudgetFailure;
      releaseBudget.resolve();
      if (siblingStartedInParallel) {
        await riskSawAbort.promise;
        await Promise.resolve();
        expect(settled).toBe(false);
      }
      expect(draftSpy).not.toHaveBeenCalled();
      releaseRisk.resolve();
      await expect(run).rejects.toBe(budgetFailure);
      expect(siblingStartedInParallel).toBe(true);
    } finally {
      releaseRisk.resolve();
      releaseBudget.resolve();
    }

    expect(settled).toBe(true);
    expect(draftSpy).not.toHaveBeenCalled();
  });

  it('aborts and awaits budget when the independent risk stage fails first', async () => {
    const { root, service } = setup('anthropic');
    const riskFailure = new Error('risk stage failed');
    const budgetStarted = deferred();
    const budgetSawAbort = deferred();
    const releaseBudgetSibling = deferred();
    let riskStartedBeforeBudgetRelease = false;
    const draftSpy = vi.spyOn(MessageDrafterAgent.prototype, 'runPareMessageDraftAgent');

    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async function (_ctx, signal) {
      budgetStarted.resolve();
      if (signal?.aborted) budgetSawAbort.resolve();
      else signal?.addEventListener('abort', () => budgetSawAbort.resolve(), { once: true });
      await releaseBudgetSibling.promise;
      throw new Error('budget sibling settled after cancellation');
    });
    vi.spyOn(RiskAgent.prototype, 'runPareRiskAgent').mockImplementation(async () => {
      riskStartedBeforeBudgetRelease = true;
      throw riskFailure;
    });

    let settled = false;
    const run = service.handleEmergencyTrigger(root.triggerId);
    void run.then(() => { settled = true; }, () => { settled = true; });
    try {
      await budgetStarted.promise;
      await Promise.resolve();
      const siblingStartedInParallel = riskStartedBeforeBudgetRelease;
      if (!siblingStartedInParallel) releaseBudgetSibling.resolve();
      else {
        await budgetSawAbort.promise;
        await Promise.resolve();
        expect(settled).toBe(false);
      }
      releaseBudgetSibling.resolve();
      expect(draftSpy).not.toHaveBeenCalled();
      await expect(run).rejects.toBe(riskFailure);
      expect(siblingStartedInParallel).toBe(true);
    } finally {
      releaseBudgetSibling.resolve();
    }

    expect(settled).toBe(true);
    expect(draftSpy).not.toHaveBeenCalled();
  });

  it('blocks drafting when a completed budget output is changed', async () => {
    const { root, adapter, service } = setup('anthropic');
    const original = BudgetAgent.prototype.runPareBudgetAgent;
    vi.spyOn(BudgetAgent.prototype, 'runPareBudgetAgent').mockImplementation(async function (this: BudgetAgent, ctx, signal, chain) {
      const result = await original.call(this, ctx, signal, chain);
      return { ...result, output: { ...result.output, summary: 'tampered after budget completion' } };
    });

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'blocked', code: 'synthetic_provenance_required',
    });
    expect(adapter.requests.some(({ useCaseId }) => useCaseId === 'pare.message-drafts')).toBe(false);
  });

  it('blocks drafting when the shared PARE correlation ID changes', async () => {
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
    expect(adapter.requests.some(({ useCaseId }) => useCaseId === 'pare.message-drafts')).toBe(false);
  });

  it('blocks a mutated tool result before the provider can continue its tool loop', async () => {
    const { root, adapter, registry, service } = setup('anthropic');
    const verify = registry.verify.bind(registry);
    vi.spyOn(registry, 'verify').mockImplementation(async (input) => {
      if (input && typeof input === 'object' && !Array.isArray(input) && 'withdrawnSupplierQuote' in input) {
        Object.assign(input, { remainingBudget: 7_499 });
      }
      return verify(input);
    });

    await expect(service.handleEmergencyTrigger(root.triggerId)).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'blocked', code: 'synthetic_provenance_required',
    });
    expect(adapter.requests.some(({ useCaseId }) => useCaseId === 'pare.message-drafts')).toBe(false);
  });

  it('blocks drafting when a completed root audit outcome changes', async () => {
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
    expect(adapter.requests.some(({ useCaseId }) => useCaseId === 'pare.message-drafts')).toBe(false);
  });

  it('allows PMCM approval only while every completed stage audit still matches the chain', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const approved = await service.approveRecommendation(pending.id, 'pmcm-reviewer');

    expect(approved.status).toBe('approved');
    expect(state.audits.find((row) => row.featureName === 'PARE')?.status).toBe('approved');
    expect(approved.pareResult.drafts).toEqual(outputs['pare.message-drafts']);
  });

  it('keeps already-pending linear provenance version 1 approvals reviewable', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const parentAudit = state.audits.find((row) => row.featureName === 'PARE');
    const auditPayload = parentAudit?.sanitizedPayload as Record<string, unknown> | undefined;
    if (!auditPayload) throw new Error('Expected a PARE aggregate audit');
    auditPayload.pareProvenanceVersion = 1;

    const stageAudits = new Map(state.audits.filter((row) => row.useCaseId).map((row) => [row.useCaseId, row]));
    const budgetChain = (stageAudits.get('pare.budget')!.sanitizedPayload as Record<string, unknown>)._aiPareChain as Record<string, unknown>;
    const riskAudit = stageAudits.get('pare.risk')!;
    const riskPayload = riskAudit.sanitizedPayload as Record<string, unknown>;
    const riskChain = riskPayload._aiPareChain as Record<string, unknown>;
    const parentEvidence = auditPayload.runEvidence as Record<string, unknown>[];
    const riskEvidence = parentEvidence.find((item) => item.useCaseId === 'pare.risk')!.pareChain as Record<string, unknown>;
    const legacyRiskLinks = {
      stageIndex: 1,
      priorAuditIds: [budgetChain.auditId],
      priorOutputDigests: [budgetChain.outputDigest],
    };
    Object.assign(riskChain, legacyRiskLinks);
    Object.assign(riskEvidence, legacyRiskLinks);

    const approved = await service.approveRecommendation(pending.id, 'pmcm-reviewer');

    expect(approved.status).toBe('approved');
    expect(approved.pareResult.drafts).toEqual(outputs['pare.message-drafts']);
  });

  it('keeps pre-chain pending PARE approvals reviewable after the migration', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const parentAudit = state.audits.find((row) => row.featureName === 'PARE');
    const auditPayload = parentAudit?.sanitizedPayload as Record<string, unknown> | undefined;
    if (!auditPayload) throw new Error('Expected a PARE aggregate audit');
    auditPayload.pareProvenanceVersion = 0;
    delete auditPayload.reviewPayloadDigest;
    auditPayload.runEvidence = (auditPayload.runEvidence as Record<string, unknown>[]).map((item) => {
      const legacyItem = { ...item };
      delete legacyItem.pareChain;
      return legacyItem;
    });

    const approved = await service.approveRecommendation(pending.id, 'pmcm-reviewer');

    expect(approved.status).toBe('approved');
    expect(approved.pareResult.drafts).toEqual(outputs['pare.message-drafts']);
  });

  it('rejects chain evidence when the version marker is missing', async () => {
    const { root, state, service } = setup('anthropic');
    const pending = await service.handleEmergencyTrigger(root.triggerId);
    const parentAudit = state.audits.find((row) => row.featureName === 'PARE');
    const auditPayload = parentAudit?.sanitizedPayload as Record<string, unknown> | undefined;
    if (!auditPayload) throw new Error('Expected a PARE aggregate audit');
    delete auditPayload.pareProvenanceVersion;

    await expect(service.approveRecommendation(pending.id, 'pmcm-reviewer'))
      .rejects.toThrow(/supported PARE provenance version/i);
    expect(state.approvals[0]?.status).toBe('pending_human_approval');
  });

  it('fails closed when live PARE has no server-owned chain verifier', async () => {
    const { root, prisma, state, adapter, gateway } = setup('anthropic');
    const serviceWithoutVerifier = new PAREService(prisma, undefined, gateway, createRuntime('anthropic'));

    await expect(serviceWithoutVerifier.handleEmergencyTrigger(root.triggerId))
      .rejects.toThrow(/server-owned synthetic provenance-chain verifier/i);
    expect(adapter.requests).toHaveLength(0);
    expect(state.approvals).toHaveLength(0);
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
