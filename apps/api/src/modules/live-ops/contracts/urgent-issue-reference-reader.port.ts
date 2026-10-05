import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type UrgentIssueReference = {
  id: string;
  eventId: string;
};

/** LiveOps-owned same-event incident lookup for commands that require a current issue. */
export interface UrgentIssueReferenceReader {
  findUrgentIssueForEvent(
    eventId: string,
    issueId: string,
    transaction?: PrismTransactionContext,
  ): Promise<UrgentIssueReference | null>;
}

export const URGENT_ISSUE_REFERENCE_READER = Symbol('URGENT_ISSUE_REFERENCE_READER');
