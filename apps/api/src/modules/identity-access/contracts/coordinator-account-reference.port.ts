import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export interface CoordinatorAccountEligibilityReader {
  /** Locks the Identity account in a caller transaction before checking current coordinator eligibility. */
  isCoordinatorAccountEligible(userId: string, transaction?: PrismTransactionContext): Promise<boolean>;
  /** Email addresses of approved PMCM administrators, for alerts PMCM must act on (never exposed to other roles). */
  listPmcmAdminEmails(transaction?: PrismTransactionContext): Promise<string[]>;
}

export const COORDINATOR_ACCOUNT_ELIGIBILITY_READER = Symbol('COORDINATOR_ACCOUNT_ELIGIBILITY_READER');