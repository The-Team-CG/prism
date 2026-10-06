import { Injectable } from '@nestjs/common';
import type { ProposalReviewOwner, ProposalReviewOwnerUpdate } from '../../contracts/proposal-review-owner.port';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

@Injectable()
export class ProposalReviewOwnerService implements ProposalReviewOwner {
  async updateProposalReview(input: ProposalReviewOwnerUpdate, transaction: PrismTransactionContext) {
    const result = await transaction.prisma.opsEvent.updateMany({
      where: {
        id: input.eventId,
        proposalClientStatus: { not: 'approved' },
        proposalRevisionCount: input.expectedRevisionCount,
        clientPortalStatus: 'unlocked',
        archived: false,
      },
      data: {
        proposalClientStatus: input.nextStatus,
        proposalRevisionCount: input.nextRevisionCount,
        proposalReviewedAt: input.reviewedAt,
        proposalReviewedBy: input.reviewedBy,
      },
    });
    return result.count;
  }
}
