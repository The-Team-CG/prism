import { describe, expect, it, vi } from 'vitest';
import { ProposalLifecycleService, PROPOSAL_LIFECYCLE_POLICY } from './proposal-lifecycle.service';
import { OpsUserRole } from '@prism/kernel/event-core';
import { proposalPackageLimit } from '@prism/types';

const verified = { id: 'pmcm-1', actorId: 'pmcm-1', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'pmcm@test', actorEmail: 'pmcm@test', name: 'PMCM', actorName: 'PMCM', expiresAt: '2099-01-01T00:00:00.000Z' } as never;
const actor = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test', explicit: true, verified: true };
function fixture() {
  const event = { id: 'evt-1', archived: false, clientPortalStatus: 'unlocked', eventDate: new Date('2099-01-01'), proposalClientStatus: 'revision_requested', proposalReviewedAt: new Date('2026-10-01'), proposalRevisionCount: 0 };
  const estimate = { id: 'ce-1', eventId: event.id, budgetAmount: 100000, totalAmount: 90000, status: 'draft', notes: '', createdAt: new Date(), lines: [{ id: 'line-1', category: 'Venue', description: 'Room', quantity: 1, unitAmount: 90000, totalAmount: 90000, sourceLineId: null }] };
  const versions: Array<Record<string, unknown>> = [];
  const audits: Array<{ affectedId?: string; metadata: Record<string, unknown> }> = [];
  const tx = { opsAuditLog: { findFirst: vi.fn(async ({ where }: { where: { metadata: { equals: string } } }) => audits.find((entry) => entry.metadata.idempotencyKey === where.metadata.equals) ?? null) }, opsEvent: { findUnique: vi.fn(async () => event), update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(event, data)) }, opsCostEstimate: { create: vi.fn(async () => estimate), findFirst: vi.fn(async () => estimate) }, opsProposalVersion: { findFirst: vi.fn(async (args?: { where?: { id?: string } }) => (args?.where?.id ? versions.find((version) => version.id === args.where?.id) ?? null : versions[versions.length - 1] ?? null)), create: vi.fn(async (args: { data: Record<string, unknown> }) => { const version = { ...args.data, issuedAt: new Date(), createdAt: new Date() }; versions.push(version); return version; }), update: vi.fn() } };
  const prisma = { $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) };
  const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn() };
  const audit = { write: vi.fn(async (input: { affectedId?: string; metadata?: Record<string, unknown> }) => { audits.push({ affectedId: input.affectedId, metadata: input.metadata ?? {} }); }) };
  const vault = { registerDocument: vi.fn(async () => ({ id: 'doc-1' })), attachStoredFile: vi.fn() };
  const storage = { requestUpload: vi.fn(async () => ({ status: 'ready', object: { id: 'obj-1', checksumSha256: 'hash', providerObjectKey: 'proposal.pdf' } })), confirmUpload: vi.fn(async () => ({ providerObjectKey: 'proposal.pdf' })) };
  const proposalReviewOwner = { updateProposalReview: vi.fn(async (input: { nextStatus: string; reviewedAt: Date | null; reviewedBy: string | null }) => { Object.assign(event, { proposalClientStatus: input.nextStatus, proposalReviewedAt: input.reviewedAt, proposalReviewedBy: input.reviewedBy }); return 1; }) };
  return { service: new ProposalLifecycleService(prisma as never, access as never, audit as never, vault as never, proposalReviewOwner as never, storage as never), event, tx, versions, access, audit, vault, storage, proposalReviewOwner };
}

describe('ProposalLifecycleService', () => {
  it('rejects issuance when the PDF cannot be stored instead of reporting an issued proposal', async () => {
    const f = fixture();
    f.storage.confirmUpload.mockRejectedValueOnce(new Error('Storage offline'));
    await expect(f.service.issueProposalVersion('evt-1', { title: 'Proposal', summary: '', costEstimateId: 'ce-1', revisionNote: '' }, actor, verified)).rejects.toThrow('Storage offline');
    expect(f.vault.attachStoredFile).not.toHaveBeenCalled();
    expect(f.audit.write).not.toHaveBeenCalled();
  });
  it('offers a second package only for a range or unconfirmed budget, unless PMCM gives a reason', async () => {
    expect(['PHP 500,000', 'PHP 300k - 500k', '300,000 to 450,000', ''].map(proposalPackageLimit)).toEqual([1, 2, 2, 2]);
    const f = fixture();
    const optionB = { id: 'ce-2', totalAmount: 120000 };
    f.tx.opsCostEstimate.findFirst = vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'ce-2' ? optionB : { id: 'ce-1', eventId: 'evt-1', totalAmount: 90000, lines: [] })) as never;
    (f.tx as Record<string, unknown>).opsBriefing = { findFirst: vi.fn(async () => ({ budgetRange: 'PHP 500,000' })) };
    const base = { title: 'Proposal', summary: '', costEstimateId: 'ce-1', alternativeCostEstimateId: 'ce-2', revisionNote: '' };
    await expect(f.service.issueProposalVersion('evt-1', base, actor, verified)).rejects.toThrow('one fixed budget');
    await f.service.issueProposalVersion('evt-1', { ...base, packageOverrideReason: 'Client asked for a premium option' }, actor, verified);
    expect(f.versions[0]).toMatchObject({ alternativeCostEstimateId: 'ce-2', alternativeTotalAmount: 120000, packageOverrideReason: 'Client asked for a premium option' });
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
  it('replays an identical retry with the same key and refuses the key for different content', async () => {
    const f = fixture();
    const input = { title: 'Forum proposal', summary: 'Scope', costEstimateId: 'ce-1', revisionNote: '', idempotencyKey: 'draft-1' };
    const first = await f.service.issueProposalVersion('evt-1', input, actor, verified);
    const retry = await f.service.issueProposalVersion('evt-1', { ...input }, actor, verified);
    expect(retry.id).toBe(first.id);
    expect(retry.versionNumber).toBe(1);
    expect(f.versions).toHaveLength(1);
    expect(f.vault.registerDocument).toHaveBeenCalledTimes(1);
    await expect(f.service.issueProposalVersion('evt-1', { ...input, title: 'Changed title' }, actor, verified)).rejects.toThrow('different proposal');
    expect(f.versions).toHaveLength(1);
  });

  it('issues a new version for a request without a key', async () => {
    const f = fixture();
    const input = { title: 'Forum proposal', summary: '', costEstimateId: 'ce-1', revisionNote: '' };
    await f.service.issueProposalVersion('evt-1', input, actor, verified);
    await f.service.issueProposalVersion('evt-1', input, actor, verified);
    expect(f.versions).toHaveLength(2);
  });
});

describe('ProposalLifecycleService previous estimates (FR-19)', () => {
  it('returns at most three estimates from the same client\'s other events, newest first', async () => {
    const others = [1, 2, 3, 4].map((n) => ({ id: `evt-old-${n}`, eventName: `Gala ${n}`, eventDate: new Date(`202${n}-01-01T00:00:00.000Z`) }));
    const prisma = {
      opsEvent: {
        findUnique: vi.fn(async () => ({ inquiry: { email: ' Ana@Client.test ' } })),
        findMany: vi.fn(async () => others),
      },
      opsCostEstimate: {
        findFirst: vi.fn(async ({ where }: { where: { eventId: string } }) => (where.eventId === 'evt-old-2'
          ? null
          : { totalAmount: 100_000, lines: [{ category: 'Venue', description: 'Hall', quantity: { toString: () => '1' }, unitAmount: 100_000 }] })),
      },
    };
    const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn() };
    const service = new ProposalLifecycleService(prisma as never, access as never, {} as never, {} as never, {} as never, {} as never);
    const result = await service.previousCostEstimates('evt-1', actor);
    expect(result.map((item) => item.eventId)).toEqual(['evt-old-1', 'evt-old-3', 'evt-old-4']);
    expect(prisma.opsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { not: 'evt-1' }, inquiry: { email: { equals: 'ana@client.test', mode: 'insensitive' } } } }));
    expect(result[0]!.lines[0]).toEqual({ category: 'Venue', description: 'Hall', quantity: 1, unitAmount: 100_000 });
  });
});
