import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsEventProposalReviewController } from './event-proposal-review.controller';

describe('OpsEventProposalReviewController', () => {
  it('requires a verified session to review a proposal', () => {
    const guards = Reflect.getMetadata('__guards__', OpsEventProposalReviewController.prototype.review);
    expect(guards).toContain(EventSessionGuard);
  });

  it('reviews with the verified actor', async () => {
    const proposalClientReviewService = {
      review: vi.fn(async () => ({ id: 'evt_1', proposalClientStatus: 'approved' })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input, verifiedActor) => ({
        role: verifiedActor.actorRole,
        email: verifiedActor.actorEmail,
        name: verifiedActor.actorName,
      })),
    };
    const controller = new OpsEventProposalReviewController(
      proposalClientReviewService as never,
      eventAccessPolicyService as never,
    );
    const actor = { actorRole: 'client', actorEmail: 'ana@ayala.test', actorName: 'Ana' };
    await expect(controller.review('evt_1', { action: 'approve' }, actor as never)).resolves.toEqual({
      id: 'evt_1',
      proposalClientStatus: 'approved',
    });
    expect(proposalClientReviewService.review).toHaveBeenCalledWith(
      'evt_1',
      { action: 'approve' },
      { role: 'client', email: 'ana@ayala.test', name: 'Ana' },
    );
  });
});
