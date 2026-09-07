import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { BudgetAgent } from './agents/budget.agent';
import { EventContextAgent } from './agents/event-context.agent';
import { MessageDrafterAgent } from './agents/message-drafter.agent';
import { RiskAgent } from './agents/risk.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { PAREService } from './pare.service';
import type { PAREContext } from './pare.types';

const sdk = vi.hoisted(() => ({ construct: vi.fn(), create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: sdk.create };
    constructor() { sdk.construct(); }
  },
}));

const context: PAREContext = {
  triggerId: 'request_1', eventId: 'event_1', eventName: 'Private event',
  eventDate: '2026-09-08', daysUntilEvent: 1, clientName: 'Private client',
  totalBudget: 100, spentBudget: 40, remainingBudget: 60, clientPreferences: [],
  withdrawnSupplier: { id: 'supplier_1', name: 'Private supplier', category: 'Food', tier: 'tier_1', quotedAmount: 40 },
  candidates: [{ supplierId: 'supplier_2', supplierName: 'Replacement', tier: 'tier_1', quotedAmount: 40, reliabilityScore: 1, halal: false, priorPmcmEvents: 2, reason: 'Available' }],
};

type StoredRow = { id: string; [key: string]: unknown };
function harness() {
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
  return { service: new PAREService(prisma as unknown as PrismaService), prisma, state, failures };
}

beforeEach(() => {
  vi.stubEnv('PARE_MODE', 'mock');
  sdk.create.mockRejectedValue(new Error('External SDK must not be called'));
  vi.spyOn(EventContextAgent.prototype, 'buildPareEventContext').mockResolvedValue(structuredClone(context));
  vi.spyOn(SupplierFinderAgent.prototype, 'findPareSupplierCandidates').mockResolvedValue(context.candidates ?? []);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); sdk.construct.mockClear(); sdk.create.mockClear(); });

describe('PARE governance boundary', () => {
  it('denies live mode before reading context or entering a provider adapter', async () => {
    vi.stubEnv('PARE_MODE', 'live');
    const { service } = harness();
    await expect(service.handleEmergencyTrigger('request_1')).rejects.toThrow(/PARE.*disabled/i);
    expect(EventContextAgent.prototype.buildPareEventContext).not.toHaveBeenCalled();
    expect(sdk.construct).not.toHaveBeenCalled();
  });

  it.each(['budget', 'risk', 'drafts'] as const)('denies direct live %s adapter calls before constructing the SDK', async kind => {
    const call = {
      budget: () => new BudgetAgent('live').runPareBudgetAgent(context),
      risk: () => new RiskAgent('live').runPareRiskAgent(context),
      drafts: () => new MessageDrafterAgent('live').runPareMessageDraftAgent(context),
    }[kind];
    await expect(call()).rejects.toThrow(/PARE.*disabled/i);
    expect(sdk.construct).not.toHaveBeenCalled();
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown configured mode', () => {
    vi.stubEnv('PARE_MODE', 'production');
    expect(harness).toThrow(/PARE_MODE/);
  });

  it.each(['auditCreate', 'approvalCreate'] as const)('does not return an approvable result after %s fails', async failure => {
    const { service, failures, state } = harness();
    failures[failure] = true;
    await expect(service.handleEmergencyTrigger('request_1')).rejects.toThrow('Database unavailable');
    expect(state.approvals).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it('keeps mock mode usable with an atomic, durable approval and audit', async () => {
    const { service, state } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    const approved = await service.approveRecommendation(pending.id, 'Verified PMCM');
    expect(approved).toMatchObject({ status: 'approved', reviewedBy: 'Verified PMCM', pareResult: { mode: 'mock' } });
    expect(state.approvals[0]).toMatchObject({ status: 'approved', humanApproved: true });
    expect(state.audits[0]).toMatchObject({ status: 'approved', humanApproved: true });
    expect(sdk.construct).not.toHaveBeenCalled();
  });

  it('rolls back approval when the audit update fails', async () => {
    const { service, state, failures } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    failures.auditUpdate = true;
    await expect(service.approveRecommendation(pending.id, 'Verified PMCM')).rejects.toThrow('Audit unavailable');
    expect(state.approvals[0]).toMatchObject({ status: 'pending_human_approval' });
    expect(state.audits[0]).toMatchObject({ status: 'pending_human_approval' });
  });

  it('cannot approve a historical live recommendation through mock mode', async () => {
    const { service, state } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    state.audits[0].modelVersion = 'claude-sonnet-4-6';
    state.audits[0].zdrConfirmed = false;
    await expect(service.approveRecommendation(pending.id, 'Verified PMCM')).rejects.toThrow(/PARE.*disabled/i);
    expect(state.approvals[0].status).toBe('pending_human_approval');
  });

  it('does not reverse an already rejected recommendation', async () => {
    const { service } = harness();
    const pending = await service.handleEmergencyTrigger('request_1');
    await service.rejectRecommendation(pending.id, 'Verified PMCM');
    await expect(service.approveRecommendation(pending.id, 'Verified PMCM')).rejects.toThrow(/pending/);
  });
});
