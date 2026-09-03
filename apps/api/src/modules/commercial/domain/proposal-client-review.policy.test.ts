import { describe, expect, it } from 'vitest';
import {
  isPrimaryClientContact,
  MAX_PROPOSAL_REVISIONS,
  nextProposalClientReview,
} from './proposal-client-review.policy';

describe('proposal-client-review.policy', () => {
  it('matches the inquiry email as the only primary contact', () => {
    expect(isPrimaryClientContact('ana@ayala.test', 'Ana@ayala.test')).toBe(true);
    expect(isPrimaryClientContact('other@ayala.test', 'ana@ayala.test')).toBe(false);
  });

  it('caps revisions and blocks a second approve', () => {
    expect(nextProposalClientReview({ status: 'pending', revisionCount: 0 }, 'approve')).toEqual({
      status: 'approved',
      revisionCount: 0,
    });
    expect(nextProposalClientReview({ status: 'pending', revisionCount: 2 }, 'request_revision')).toEqual({
      status: 'revision_requested',
      revisionCount: 3,
    });
    expect(() => nextProposalClientReview({ status: 'approved', revisionCount: 0 }, 'approve')).toThrow(
      /already approved/,
    );
    expect(() =>
      nextProposalClientReview({ status: 'revision_requested', revisionCount: MAX_PROPOSAL_REVISIONS }, 'request_revision'),
    ).toThrow(/revision cap/);
  });
});
