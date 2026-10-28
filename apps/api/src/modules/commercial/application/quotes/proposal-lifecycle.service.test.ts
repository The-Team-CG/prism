import { describe, expect, it, vi } from 'vitest';
import { ProposalLifecycleService, PROPOSAL_LIFECYCLE_POLICY } from './proposal-lifecycle.service';
import { OpsUserRole } from '@prism/kernel/event-core';

const verified = { id: 'pmcm-1', actorId: 'pmcm-1', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'pmcm@test', actorEmail: 'pmcm@test', name: 'PMCM', actorName: 'PMCM', expiresAt: '2099-01-01T00:00:00.000Z' } as never;
const actor = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test', explicit: true, verified: true };
function fixture() {
  const event = { id: 'evt-1', archived: false, clientPortalStatus: 'unlocked', eventDate: new Date('2099-01-01'), proposalClientStatus: 'revision_requested', proposalReviewedAt: new Date('2026-10-01'), proposalRevisionCount: 0 };
  const estimate = { id: 'ce-1', eventId: event.id, budgetAmount: 100000, totalAmount: 90000, status: 'draft', notes: '', createdAt: new Date(), lines: [{ id: 'line-1', category: 'Venue', description: 'Room', quantity: 1, unitAmount: 90000, totalAmount: 90000, sourceLineId: null }] };
  const tx = { opsEvent: { findUnique: vi.fn(async () => event), update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(event, data)) }, opsCostEstimate: { create: vi.fn(async () => estimate), findFirst: vi.fn(async () => estimate) }, opsProposalVersion: { findFirst: vi.fn(async () => null), create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...args.data, issuedAt: new Date(), createdAt: new Date() })), update: vi.fn() } };
  const prisma = { $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) };
  const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn() };
  const audit = { write: vi.fn(async () => undefined) };
  const vault = { registerDocument: vi.fn(async () => ({ id: 'doc-1' })), attachStoredFile: vi.fn() };
  const storage = { requestUpload: vi.fn(async () => ({ status: 'ready', object: { id: 'obj-1', checksumSha256: 'hash', providerObjectKey: 'proposal.pdf' } })), confirmUpload: vi.fn(async () => ({ providerObjectKey: 'proposal.pdf' })) };
  const proposalReviewOwner = { updateProposalReview: vi.fn(async (input: { nextStatus: string; reviewedAt: Date | null; reviewedBy: string | null }) => { Object.assign(event, { proposalClientStatus: input.nextStatus, proposalReviewedAt: input.reviewedAt, proposalReviewedBy: input.reviewedBy }); return 1; }) };
  return { service: new ProposalLifecycleService(prisma as never, access as never, audit as never, vault as never, proposalReviewOwner as never, storage as never), event, tx, access, audit, vault, storage, proposalReviewOwner };
}

describe('ProposalLifecycleService', () => {
  it('rejects issuance when the PDF cannot be stored instead of reporting an issued proposal', async () => {
    const f = fixture();
    f.storage.confirmUpload.mockRejectedValueOnce(new Error('Storage offline'));
    await expect(f.service.issueProposalVersion('evt-1', { title: 'Proposal', summary: '', costEstimateId: 'ce-1', revisionNote: '' }, actor, verified)).rejects.toThrow('Storage offline');
    expect(f.vault.attachStoredFile).not.toHaveBeenCalled();
    expect(f.audit.write).not.toHaveBeenCalled();
  });
  it('calculates category totals and budget alignment transactionally', async () => {
    const f = fixture();
    const result = await f.service.createCostEstimate('evt-1', { budgetAmount: 100000, lines: [{ category: 'Venue', description: 'Room', quantity: 1, unitAmount: 90000 }], notes: '' }, actor);
    expect(result.alignment).toBe('within_budget');
    expect(f.access.requireCanReadEvent).toHaveBeenCalled();
    expect(f.audit.write).toHaveBeenCalled();
  });

  it('issues version one with the named policy defaults', async () => {
    const f = fixture();
    const result = await f.service.issueProposalVersion('evt-1', { title: 'Forum proposal', summary: '', costEstimateId: 'ce-1', revisionNote: '' }, actor, verified);
    expect(result.versionNumber).toBe(1);
    expect(f.vault.attachStoredFile).toHaveBeenCalledWith(expect.objectContaining({ storageKey: 'proposal.pdf' }), expect.objectContaining({ prisma: f.tx }));
    expect(f.event.proposalClientStatus).toBe('pending');
    expect(f.proposalReviewOwner.updateProposalReview).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-1', expectedRevisionCount: 0, nextStatus: 'pending', reviewedAt: null, reviewedBy: null }), expect.objectContaining({ actorId: actor.id }));
    expect(f.event.proposalReviewedAt).toBeNull();
    expect(PROPOSAL_LIFECYCLE_POLICY.issuedVersionsImmutable).toBe(true);
    expect(f.audit.write).toHaveBeenCalled();
  });
});
