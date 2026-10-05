import type { UpdateWalkInPolicyInput } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type EventReadAccessReference = {
  id: string;
  clientName: string;
  clientPortalStatus: string;
  clientEmail: string | null;
  inquiry: { email: string } | null;
};

export type OperationsEventReference = {
  id: string;
  eventName: string;
  eventDate: Date;
  status: string;
  archived: boolean;
  actualEndedAt: Date | null;
  walkInPolicy: string;
  walkInThreshold: number;
};

export type WalkInPolicySnapshot = {
  eventId: string;
  eventName: string;
  policy: string;
  threshold: number;
};

export type WalkInPolicyChange = {
  before: WalkInPolicySnapshot;
  after: WalkInPolicySnapshot;
};

/** Lifecycle-owned event state used by Operations command eligibility checks. */
export interface OperationsEventReferenceReader {
  findOperationsEvent(eventId: string, transaction?: PrismTransactionContext): Promise<OperationsEventReference | null>;
  findOperationsEvents(eventIds: readonly string[]): Promise<OperationsEventReference[]>;
  findEventReadAccess(eventId: string): Promise<EventReadAccessReference | null>;
}

/** Lifecycle-owned mutation for guest policy stored on the event record. */
export interface WalkInPolicyOwner {
  updateWalkInPolicy(
    eventId: string,
    input: UpdateWalkInPolicyInput,
    transaction: PrismTransactionContext,
  ): Promise<WalkInPolicyChange | null>;
}

export const OPERATIONS_EVENT_REFERENCE_READER = Symbol('OPERATIONS_EVENT_REFERENCE_READER');
export const WALK_IN_POLICY_OWNER = Symbol('WALK_IN_POLICY_OWNER');