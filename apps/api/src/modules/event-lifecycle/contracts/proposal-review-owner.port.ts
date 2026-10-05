import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type ProposalReviewOwnerUpdate = {
  eventId: string;
  expectedRevisionCount: number;
  nextStatus: string;
  nextRevisionCount: number;
  reviewedAt: Date;
  reviewedBy: string;
};

/** Lifecycle-owned compare-and-set update for proposal review state stored on OpsEvent. */
export interface ProposalReviewOwner {
  updateProposalReview(input: ProposalReviewOwnerUpdate, transaction: PrismTransactionContext): Promise<number>;
}

export const PROPOSAL_REVIEW_OWNER = Symbol('PROPOSAL_REVIEW_OWNER');
