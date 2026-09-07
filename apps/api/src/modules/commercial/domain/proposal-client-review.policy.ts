import type { ReviewEventProposalInput } from '@prism/types';

export const MAX_PROPOSAL_REVISIONS = 3;

export function isPrimaryClientContact(actorEmail: string | undefined | null, inquiryEmail: string) {
  return Boolean(actorEmail && actorEmail.trim().toLowerCase() === inquiryEmail.trim().toLowerCase());
}

export function nextProposalClientReview(
  current: { status: string; revisionCount: number },
  action: ReviewEventProposalInput['action'],
) {
  if (current.status === 'approved') {
    throw new Error('Proposal is already approved');
  }
  if (action === 'approve') {
    return { status: 'approved' as const, revisionCount: current.revisionCount };
  }
  if (current.revisionCount >= MAX_PROPOSAL_REVISIONS) {
    throw new Error(`Proposal revision cap of ${MAX_PROPOSAL_REVISIONS} has been reached`);
  }
  return { status: 'revision_requested' as const, revisionCount: current.revisionCount + 1 };
}
