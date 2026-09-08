import { describe, expect, it, vi } from 'vitest';
import { ProposalLifecycleService, PROPOSAL_LIFECYCLE_POLICY } from './proposal-lifecycle.service';
import { OpsUserRole } from '@prism/kernel/event-core';

const actor = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test' };
function fixture() {
  const event = { id: 'evt-1', archived: false, clientPortalStatus: 'unlocked', eventDate: new Date('2099-01-01') };
  const estimate = { id: 'ce-1', eventId: event.id, budgetAmount: 100000, totalAmount: 90000, status: 'draft', notes: '', createdAt: new Date(), lines: [{ id: 'line-1', category: 'Venue', description: 'Room', quantity: 1, unitAmount: 90000, totalAmount: 90000, sourceLineId: null }] };
  const tx = { opsEvent: { findUnique: vi.fn(async () => event) }, opsCostEstimate: { create: vi.fn(async () => estimate), findFirst: vi.fn(async () => estimate) }, opsProposalVersion: { findFirst: vi.fn(async () => null), create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...args.data, issuedAt: new Date(), createdAt: new Date() })), update: vi.fn() } };
  const prisma = { $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) };
  const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn() };
  const audit = { write: vi.fn(async () => undefined) };
  return { service: new ProposalLifecycleService(prisma as never, access as never, audit as never), tx, access, audit };
}

describe('ProposalLifecycleService', () => {
  it('calculates category totals and budget alignment transactionally', async () => {
    const f = fixture();
    const result = await f.service.createCostEstimate('evt-1', { budgetAmount: 100000, lines: [{ category: 'Venue', description: 'Room', quantity: 1, unitAmount: 90000 }], notes: '' }, actor);
    expect(result.alignment).toBe('within_budget');
    expect(f.access.requireCanReadEvent).toHaveBeenCalled();
    expect(f.audit.write).toHaveBeenCalled();
  });

  it('issues version one with the named policy defaults', async () => {
    const f = fixture();
    const result = await f.service.issueProposalVersion('evt-1', { title: 'Forum proposal', summary: '', costEstimateId: 'ce-1', revisionNote: '' }, actor);
    expect(result.versionNumber).toBe(1);
    expect(PROPOSAL_LIFECYCLE_POLICY.issuedVersionsImmutable).toBe(true);
    expect(f.audit.write).toHaveBeenCalled();
  });
});
