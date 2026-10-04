import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type LiveOpsCoordinatorReference = {
  id: string;
  name: string;
  active: boolean;
};

export type LiveOpsAssignmentReference = {
  id: string;
  eventId: string;
  coordinatorId: string | null;
  coordinatorName: string;
  role: string;
  status: string;
};

/** Operations-owned current coordinator and assignment facts required by LiveOps commands. */
export interface OperationsLiveOpsReferenceReader {
  findCoordinatorProfile(coordinatorId: string): Promise<LiveOpsCoordinatorReference | null>;
  findEligibleOperatorAssignment(
    eventId: string,
    coordinatorId: string,
    transaction: PrismTransactionContext,
  ): Promise<LiveOpsAssignmentReference | null>;
  findEligibleHandoffAssignments(
    eventId: string,
    assignmentIds: readonly string[],
    transaction: PrismTransactionContext,
  ): Promise<LiveOpsAssignmentReference[]>;
}

export const OPERATIONS_LIVE_OPS_REFERENCE_READER = Symbol('OPERATIONS_LIVE_OPS_REFERENCE_READER');
