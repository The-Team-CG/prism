import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export interface CoordinatorAccountEligibilityReader {
  /** Locks the Identity account in a caller transaction before checking current coordinator eligibility. */
  isCoordinatorAccountEligible(userId: string, transaction?: PrismTransactionContext): Promise<boolean>;
}

export const COORDINATOR_ACCOUNT_ELIGIBILITY_READER = Symbol('COORDINATOR_ACCOUNT_ELIGIBILITY_READER');