import type { ReviewSupplierApplicationInput } from '@prism/types';

export function applicationStatusForReviewAction(action: ReviewSupplierApplicationInput['action']) {
  if (action === 'request_proposal') return 'proposal_requested';
  if (action === 'schedule') return 'meeting_scheduled';
  if (action === 'approve') return 'approved';
  return 'declined';
}
