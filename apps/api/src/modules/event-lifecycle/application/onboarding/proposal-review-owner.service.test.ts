import { describe, expect, it, vi } from 'vitest';
import { ProposalReviewOwnerService } from './proposal-review-owner.service';

describe('ProposalReviewOwnerService', () => {
  it('resets the client review state with the lifecycle-owned compare-and-set', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const service = new ProposalReviewOwnerService();

    await expect(service.updateProposalReview({
      eventId: 'evt_1',
      expectedRevisionCount: 2,
      nextStatus: 'pending',
      nextRevisionCount: 2,
      reviewedAt: null,
      reviewedBy: null,
    }, { prisma: { opsEvent: { updateMany } } } as never)).resolves.toBe(1);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', proposalClientStatus: { not: 'approved' }, proposalRevisionCount: 2, clientPortalStatus: 'unlocked', archived: false },
      data: { proposalClientStatus: 'pending', proposalRevisionCount: 2, proposalReviewedAt: null, proposalReviewedBy: null },
    });
  });

  it('reports a stale proposal state when the compare-and-set loses', async () => {
    const service = new ProposalReviewOwnerService();
    const transaction = { prisma: { opsEvent: { updateMany: vi.fn(async () => ({ count: 0 })) } } };
    await expect(service.updateProposalReview({ eventId: 'evt_1', expectedRevisionCount: 1, nextStatus: 'pending', nextRevisionCount: 1, reviewedAt: null, reviewedBy: null }, transaction as never)).resolves.toBe(0);
  });
});
