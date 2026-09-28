import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiAuditEvidenceSchema,
  type AiAuditEvidence,
  type AiGatewayRunFailure,
  type AiGatewayRunResult,
  type AiUseCaseId,
  type AiUseCaseInput,
  type AiUseCaseOutput,
} from '@prism/types';
import type { PrismaService } from '@prism/kernel/database';
import type { AiGateway, AiGatewayCallOptions } from '../../../contracts/ai-governance/ai-gateway.port';
import { BudgetAgent } from './agents/budget.agent';
import { EventContextAgent } from './agents/event-context.agent';
import { MessageDrafterAgent } from './agents/message-drafter.agent';
import { RiskAgent } from './agents/risk.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { PAREService } from './pare.service';
import type { PAREContext } from './pare.types';
import { AI_ROUTE_PROFILES } from '../gateway/ai-gateway.config';
import {
  createPareBudgetToolHandlers,
  createPareMessageDraftToolHandlers,
  createPareRiskToolHandlers,
} from './pare-ai-use-cases';

const context: PAREContext = {
  triggerId: 'request_1', eventId: 'event_1', eventName: 'Private event',
  eventDate: '2026-09-08', daysUntilEvent: 1, clientName: 'Private client',
  totalBudget: 100, spentBudget: 40, remainingBudget: 60, clientPreferences: [],
  withdrawnSupplier: { id: 'supplier_1', name: 'Private supplier', category: 'Food', tier: 'tier_1', quotedAmount: 40 },
  candidates: [{ supplierId: 'supplier_2', supplierName: 'Replacement', tier: 'tier_1', quotedAmount: 40, reliabilityScore: 1, halal: false, priorPmcmEvents: 2, reason: 'Available' }],
};

const providerRouteCases = [
  { label: 'Anthropic', profileId: 'test-anthropic', provider: 'anthropic' as const },
  { label: 'OpenRouter', profileId: 'test-openrouter', provider: 'openrouter' as const },
];

type StoredRow = { id: string; [key: string]: unknown };
type GatewayCall = {
  useCaseId: AiUseCaseId;
  input: AiUseCaseInput<AiUseCaseId>;
  options?: AiGatewayCallOptions;
};
type FakeGatewayOptions = {
  failure?: Pick<AiGatewayRunFailure, 'outcome' | 'error'>;
  outputOverride?: unknown;
  onRun?: (signal?: AbortSignal) => void;
  profileId?: string;
  provider?: AiAuditEvidence['provider'];
};

function evidenceFor(
  useCaseId: AiUseCaseId,
  correlationId: string,
  outcome: AiAuditEvidence['outcome'] = 'completed',
  profileId = 'test-anthropic',
  provider: AiAuditEvidence['provider'] = 'anthropic',
): AiAuditEvidence {
  return aiAuditEvidenceSchema.parse({
    requestId: `ai_${useCaseId}`,
    correlationId,
    useCaseId,
    promptVersion: `${useCaseId}-v1`,
    profileId,
    provider,
    requestedModel: 'claude-sonnet-4-6',
    responseModel: 'claude-sonnet-4-6',
    endpointTag: provider === 'openrouter' ? 'fake-openrouter' : 'anthropic-direct',
    routeRevision: 'a'.repeat(64),
    routePolicyOutcome: 'synthetic_verified',
    zdrBasis: 'none',
    dataClasses: ['synthetic'],
    usage: { inputTokens: 10, outputTokens: 12 },
    latencyMs: 20,
    outcome,
    approvalState: 'pending',
    syntheticProvenance: {
      source: 'test-fixture',
      sourceId: 'pare-fixture-event-1',
      verifiedAt: '2026-09-24T00:00:00.000Z',
      verifier: 'test-fixture-registry',
    },
  });
}

function fakeGateway(options: FakeGatewayOptions = {}) {
  const calls: GatewayCall[] = [];
  const outputs = {
    'pare.budget': {
      feasible: true,
      selectedCandidate: context.candidates![0],
      costDelta: 0,
      costDeltaLabel: 'same cost as withdrawn supplier',
      summary: 'Replacement is within budget.',
    },
    'pare.risk': {
      level: 'LOW' as const,
      factors: ['Adequate timeline'],
      recommendation: 'Proceed with PMCM review.',
    },
    'pare.message-drafts': {
      supplierNotification: 'Supplier draft for PMCM review.',
      clientReassurance: 'Client draft for PMCM review.',
    },
    'comms.draft': { subject: 'Draft', body: 'Draft body' },
  };

  const run = async <K extends AiUseCaseId>(
    useCaseId: K,
    input: AiUseCaseInput<K>,
    callOptions?: AiGatewayCallOptions,
  ): Promise<AiGatewayRunResult<AiUseCaseOutput<K>>> => {
    calls.push({ useCaseId, input: structuredClone(input), options: callOptions });
    options.onRun?.(callOptions?.signal);
    const evidence = evidenceFor(
      useCaseId,
      callOptions?.correlationId ?? 'missing-correlation',
      options.failure?.outcome ?? 'completed',
      options.profileId,
      options.provider,
    );
    if (options.failure) {
      return {
        outcome: options.failure.outcome,
        error: options.failure.error,
        evidence,
      };
    }
    const output = options.outputOverride ?? outputs[useCaseId];
    return {
      outcome: 'completed',
      output: output as AiUseCaseOutput<K>,
      evidence,
    };
  };

  const gateway: AiGateway = {
    run,
    async *stream<K extends AiUseCaseId>() {
      // PARE currently uses run; the empty fake stream keeps the port complete.
      return;
    },
  };
  return { gateway, calls };
}

function harness(gateway?: AiGateway) {
  const state = { audits: [] as StoredRow[], approvals: [] as StoredRow[] };
  const failures = { auditCreate: false, auditUpdate: false, approvalCreate: false };
  function model(rows: StoredRow[], kind: 'audit' | 'approval') {
    return {
      create: vi.fn(async ({ data }: { data: StoredRow }) => {
        if ((kind === 'audit' && failures.auditCreate) || (kind === 'approval' && failures.approvalCreate)) throw new Error('Database unavailable');
        rows.push(data); return data;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find(row => row.id === where.id) ?? null),
      findMany: vi.fn(async () => rows),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (kind === 'audit' && failures.auditUpdate) throw new Error('Audit unavailable');
        const row = rows.find(item => item.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data); return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (kind === 'audit' && failures.auditUpdate) throw new Error('Audit unavailable');
        const matches = rows.filter(row => Object.entries(where).every(([key, value]) => row[key] === value));
        matches.forEach(row => Object.assign(row, data)); return { count: matches.length };
      }),
    };
  }
  const prisma = {
    opsAiAuditLog: model(state.audits, 'audit'),
    opsAiApprovalRecord: model(state.approvals, 'approval'),
    $transaction: vi.fn(async <T>(work: (tx: { opsAiAuditLog: ReturnType<typeof model>; opsAiApprovalRecord: ReturnType<typeof model> }) => Promise<T>) => {
      const draft = structuredClone(state);
      const result = await work({ opsAiAuditLog: model(draft.audits, 'audit'), opsAiApprovalRecord: model(draft.approvals, 'approval') });
      state.audits.splice(0, state.audits.length, ...draft.audits);
      state.approvals.splice(0, state.approvals.length, ...draft.approvals);
      return result;
    }),
  };
  return {
    service: new PAREService(prisma as unknown as PrismaService, undefined, gateway),
    prisma,
    state,
    failures,
  };
}

beforeEach(() => {
  vi.stubEnv('PARE_MODE', 'mock');
  vi.spyOn(EventContextAgent.prototype, 'buildPareEventContext').mockResolvedValue(structuredClone(context));
  vi.spyOn(SupplierFinderAgent.prototype, 'findPareSupplierCandidates').mockResolvedValue(context.candidates ?? []);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('PARE gateway boundary', () => {
  it('uses strict canonical schemas for read-only context tools', () => {
    const tools = [
      ...createPareBudgetToolHandlers(context),
      ...createPareRiskToolHandlers(context),
      ...createPareMessageDraftToolHandlers(context),
    ];
    const quoteTool = tools.find(tool => tool.name === 'get_quote_details');
    const eventSummaryTool = tools.find(tool => tool.name === 'get_event_and_replacement_summary');

    expect(tools.every(tool => !tool.name.startsWith('submit_'))).toBe(true);
    expect(tools.find(tool => tool.name === 'get_event_budget_summary')?.inputSchema.safeParse({}).success).toBe(true);
    expect(tools.find(tool => tool.name === 'get_event_budget_summary')?.inputSchema.safeParse({ extra: true }).success).toBe(false);
    expect(quoteTool?.inputSchema.safeParse({ supplierName: 'Replacement' }).success).toBe(true);
    expect(quoteTool?.inputSchema.safeParse({ supplierName: '' }).success).toBe(false);
    expect(eventSummaryTool?.inputSchema.safeParse({}).success).toBe(true);
  });

  it('keeps mock as the default and keeps deterministic work local', async () => {
    const { service, state } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    expect(pending.pareResult).toMatchObject({ mode: 'mock', runEvidence: [] });
    expect(state.audits[0]).toMatchObject({ modelVersion: 'mock', zdrConfirmed: true });
  });

  it('keeps the no-candidate budget result deterministic in mock mode and blocks it in live mode', async () => {
    const noCandidates = { ...context, candidates: [] };
    const mockResult = await new BudgetAgent('mock').runPareBudgetAgent(noCandidates);
    expect(mockResult.output.selectedCandidate.supplierName).toBe('No candidate found');
    expect(mockResult.evidence).toBeNull();

    const { gateway, calls } = fakeGateway();
    await expect(new BudgetAgent('live', gateway).runPareBudgetAgent(noCandidates))
      .rejects.toMatchObject({ name: 'PareAiGatewayError', code: 'invalid_input', retryable: false });
    expect(calls).toHaveLength(0);
  });

  it('fails live mode before reading event data when the gateway is not registered', async () => {
    vi.stubEnv('PARE_MODE', 'live');
    const { service } = harness();
    await expect(service.handleEmergencyTrigger('request_1')).rejects.toThrow(/gateway.*disabled/i);
    expect(EventContextAgent.prototype.buildPareEventContext).not.toHaveBeenCalled();
  });

  it('rejects live PARE at startup when the gateway still uses the mock route', () => {
    vi.stubEnv('PARE_MODE', 'live');
    const { prisma } = harness();
    const { gateway } = fakeGateway();
    expect(() => new PAREService(prisma as unknown as PrismaService, undefined, gateway, {
      profile: AI_ROUTE_PROFILES.mock,
      profileId: 'mock',
      liveUseCases: new Set(),
      isProduction: false,
    })).toThrow(/all three PARE use cases/i);
    expect(EventContextAgent.prototype.buildPareEventContext).not.toHaveBeenCalled();
  });

  it('accepts a fully enabled synthetic route without an Anthropic-specific profile requirement', () => {
    vi.stubEnv('PARE_MODE', 'live');
    const { prisma } = harness();
    const { gateway } = fakeGateway({ profileId: 'test-openrouter', provider: 'openrouter' });
    const route = {
      provider: 'openrouter' as const,
      model: 'test-model',
      endpointPolicyId: 'fake-openrouter',
      adapterRevision: 'fake-openrouter-v1',
      zdrBasis: 'none' as const,
      allowedDataClasses: ['synthetic' as const],
    };
    const profile = {
      id: 'test-openrouter',
      routesByTier: { fast: route, strong: route },
    };
    expect(() => new PAREService(prisma as unknown as PrismaService, undefined, gateway, {
      profile,
      profileId: 'test-openrouter',
      liveUseCases: new Set<AiUseCaseId>(['pare.budget', 'pare.risk', 'pare.message-drafts']),
      isProduction: false,
    })).not.toThrow();
  });

  it('rejects live PARE at startup when a PARE gateway use case is not enabled', () => {
    vi.stubEnv('PARE_MODE', 'live');
    const { prisma } = harness();
    const { gateway } = fakeGateway();
    expect(() => new PAREService(prisma as unknown as PrismaService, undefined, gateway, {
      profile: AI_ROUTE_PROFILES['test-anthropic'],
      profileId: 'test-anthropic',
      liveUseCases: new Set<AiUseCaseId>(['pare.budget', 'pare.risk']),
      isProduction: false,
    })).toThrow(/all three PARE use cases/i);
    expect(EventContextAgent.prototype.buildPareEventContext).not.toHaveBeenCalled();
  });

  it.each(['budget', 'risk', 'drafts'] as const)('fails direct live %s calls without a gateway', async kind => {
    const call = {
      budget: () => new BudgetAgent('live').runPareBudgetAgent(context),
      risk: () => new RiskAgent('live').runPareRiskAgent(context),
      drafts: () => new MessageDrafterAgent('live').runPareMessageDraftAgent(context),
    }[kind];
    await expect(call()).rejects.toThrow(/gateway.*disabled/i);
  });

  it('routes all live PARE steps through the fake gateway with context-owned tools', async () => {
    vi.stubEnv('PARE_MODE', 'live');
    const { gateway, calls } = fakeGateway();
    const { service, state } = harness(gateway);
    const pending = await service.handleEmergencyTrigger('request_1');

    expect(pending.pareResult).toMatchObject({
      mode: 'live',
      runEvidence: expect.arrayContaining([
        expect.objectContaining({ useCaseId: 'pare.budget', routePolicyOutcome: 'synthetic_verified' }),
        expect.objectContaining({ useCaseId: 'pare.risk', routePolicyOutcome: 'synthetic_verified' }),
        expect.objectContaining({ useCaseId: 'pare.message-drafts', routePolicyOutcome: 'synthetic_verified' }),
      ]),
    });
    expect(calls).toHaveLength(3);
    expect(calls.map(call => call.useCaseId).sort()).toEqual([
      'pare.budget', 'pare.message-drafts', 'pare.risk',
    ]);
    expect(calls.every(call => call.options?.signal && !call.options.signal.aborted)).toBe(true);
    expect(calls.find(call => call.useCaseId === 'pare.budget')?.input).toEqual(context);
    expect(calls.find(call => call.useCaseId === 'pare.risk')?.input).toEqual(context);
    expect(calls.find(call => call.useCaseId === 'pare.message-drafts')?.input).toMatchObject({
      budgetAnalysis: { summary: 'Replacement is within budget.' },
      riskAssessment: { level: 'LOW' },
    });
    expect(calls.flatMap(call => call.options?.tools?.map(tool => tool.name) ?? [])).toEqual(expect.arrayContaining([
      'get_event_budget_summary',
      'get_quote_details',
      'get_supplier_history',
      'get_event_timeline',
      'get_client_preferences',
      'get_event_and_replacement_summary',
    ]));
    expect(state.audits[0]).toMatchObject({ modelVersion: 'ai-gateway', zdrConfirmed: false });
  });

  it('relays caller aborts to active gateway calls and writes no PARE approval', async () => {
    vi.stubEnv('PARE_MODE', 'live');
    const controller = new AbortController();
    const observedSignals: AbortSignal[] = [];
    const { gateway } = fakeGateway({
      onRun: (signal) => {
        if (signal) observedSignals.push(signal);
        if (observedSignals.length === 1) controller.abort(new Error('caller cancelled'));
      },
    });
    const { service, state } = harness(gateway);

    await expect(service.handleEmergencyTrigger('request_1', undefined, controller.signal))
      .rejects.toThrow('caller cancelled');
    expect(observedSignals).toHaveLength(1);
    expect(observedSignals[0].aborted).toBe(true);
    expect(state.approvals).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it.each(providerRouteCases)('treats gateway step exhaustion and invalid output the same through $label', async route => {
    vi.stubEnv('PARE_MODE', 'live');
    const exhausted = fakeGateway({
      ...route,
      failure: {
        outcome: 'incomplete',
        error: { code: 'step_limit', message: 'exhausted', retryable: false },
      },
    });
    const first = harness(exhausted.gateway);
    await expect(first.service.handleEmergencyTrigger('request_1')).rejects.toMatchObject({
      name: 'PareAiGatewayError', outcome: 'incomplete', retryable: false,
    });
    expect(first.state.approvals).toHaveLength(0);
    expect(first.state.audits).toHaveLength(0);

    const invalid = fakeGateway({ ...route, outputOverride: { feasible: true } });
    const second = harness(invalid.gateway);
    await expect(second.service.handleEmergencyTrigger('request_1')).rejects.toMatchObject({
      name: 'PareAiGatewayError', code: 'invalid_output', retryable: false,
    });
    expect(second.state.approvals).toHaveLength(0);
    expect(second.state.audits).toHaveLength(0);
  });

  it.each(['auditCreate', 'approvalCreate'] as const)('does not return an approvable result after %s fails', async failure => {
    const { service, failures, state } = harness();
    failures[failure] = true;
    await expect(service.handleEmergencyTrigger('request_1')).rejects.toThrow('Database unavailable');
    expect(state.approvals).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it.each(providerRouteCases)('keeps the same PMCM approval gate and no-send behavior through $label', async route => {
    vi.stubEnv('PARE_MODE', 'live');
    const { gateway, calls } = fakeGateway(route);
    const { service, state } = harness(gateway);
    const pending = await service.handleEmergencyTrigger('request_1');
    const pendingPayload = state.audits[0].sanitizedPayload as Record<string, unknown>;
    const pendingEvidence = pendingPayload.runEvidence as Record<string, unknown>[];
    expect(state.approvals[0]).toMatchObject({ status: 'pending_human_approval' });
    expect(state.audits[0].zdrConfirmed).toBe(false);
    expect(pendingEvidence).toHaveLength(3);
    expect(pendingEvidence.every(evidence =>
      evidence.provider === route.provider && evidence.profileId === route.profileId &&
      evidence.routePolicyOutcome === 'synthetic_verified')).toBe(true);

    const approved = await service.approveRecommendation(pending.id, 'Verified PMCM');
    expect(approved).toMatchObject({
      status: 'approved', reviewedBy: 'Verified PMCM',
      pareResult: { mode: 'live', runEvidence: expect.arrayContaining([expect.objectContaining({ outcome: 'completed' })]) },
    });
    expect(state.approvals[0]).toMatchObject({ status: 'approved', humanApproved: true });
    expect(state.audits[0]).toMatchObject({ status: 'approved', humanApproved: true });
    expect(calls).toHaveLength(3);
  });

  it.each(['blocked', 'mismatched', 'unaudited', 'ineligible'] as const)(
    'rejects %s live evidence at PMCM approval', async corruption => {
      vi.stubEnv('PARE_MODE', 'live');
      const { gateway } = fakeGateway();
      const { service, state } = harness(gateway);
      const pending = await service.handleEmergencyTrigger('request_1');
      const auditPayload = state.audits[0].sanitizedPayload as Record<string, unknown>;
      const evidence = auditPayload.runEvidence as Record<string, unknown>[];
      if (corruption === 'blocked') evidence[0].outcome = 'blocked';
      if (corruption === 'mismatched') evidence[0].correlationId = 'another-request';
      if (corruption === 'unaudited') auditPayload.runEvidence = [];
      if (corruption === 'ineligible') evidence[0].routePolicyOutcome = 'mock_local';

      await expect(service.approveRecommendation(pending.id, 'Verified PMCM'))
        .rejects.toThrow(/matching durable PARE audit/);
      expect(state.approvals[0].status).toBe('pending_human_approval');
    },
  );

  it('rolls back approval when the audit update fails', async () => {
    const { service, state, failures } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    failures.auditUpdate = true;
    await expect(service.approveRecommendation(pending.id, 'Verified PMCM')).rejects.toThrow('Audit unavailable');
    expect(state.approvals[0]).toMatchObject({ status: 'pending_human_approval' });
    expect(state.audits[0]).toMatchObject({ status: 'pending_human_approval' });
  });

  it('does not approve a historical live recommendation without gateway evidence', async () => {
    const { service, state } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    state.audits[0].modelVersion = 'ai-gateway';
    state.audits[0].zdrConfirmed = false;
    const payload = state.audits[0].sanitizedPayload as Record<string, unknown>;
    payload.mode = 'live';
    payload.runEvidence = [];
    await expect(service.approveRecommendation(pending.id, 'Verified PMCM'))
      .rejects.toThrow(/matching durable PARE audit/);
    expect(state.approvals[0].status).toBe('pending_human_approval');
  });

  it('does not reverse an already rejected recommendation', async () => {
    const { service } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    await service.rejectRecommendation(pending.id, 'Verified PMCM');
    await expect(service.approveRecommendation(pending.id, 'Verified PMCM')).rejects.toThrow(/pending/);
  });
});
