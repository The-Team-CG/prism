import type { UpdateGuestPrivacyClassificationInput, UpdateWalkInPolicyInput } from '@prism/types';
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
  clientName: string;
  eventDate: Date;
  status: string;
  archived: boolean;
  actualEndedAt: Date | null;
  walkInPolicy: string;
  walkInThreshold: number;
};


export type GuestCheckInEventReference = Pick<
  OperationsEventReference,
  'id' | 'eventName' | 'walkInPolicy' | 'walkInThreshold'
> & {
  guestPrivacyClassification: string;
  briefingGuestCount: number | null;
};

export type GuestPrivacyClassificationSnapshot = {
  eventId: string;
  eventName: string;
  classification: string;
};

export type GuestPrivacyClassificationChange = {
  before: GuestPrivacyClassificationSnapshot;
  after: GuestPrivacyClassificationSnapshot;
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
  findGuestCheckInEventReference(eventId: string, transaction?: PrismTransactionContext): Promise<GuestCheckInEventReference | null>;
  findOperationsEvents(eventIds: readonly string[]): Promise<OperationsEventReference[]>;
  findEventIdsByDateRange(startsAt: Date, endsBefore: Date): Promise<string[]>;
  findEventReadAccess(eventId: string, transaction?: PrismTransactionContext): Promise<EventReadAccessReference | null>;
}

/** Lifecycle-owned mutation for guest policy stored on the event record. */
export interface WalkInPolicyOwner {
  updateWalkInPolicy(
    eventId: string,
    input: UpdateWalkInPolicyInput,
    transaction: PrismTransactionContext,
  ): Promise<WalkInPolicyChange | null>;
}

/** Lifecycle-owned mutation for PMCM-managed guest privacy classification. */
export interface GuestPrivacyClassificationOwner {
  updateGuestPrivacyClassification(
    eventId: string,
    input: UpdateGuestPrivacyClassificationInput,
    transaction: PrismTransactionContext,
  ): Promise<GuestPrivacyClassificationChange | null>;
}

export const OPERATIONS_EVENT_REFERENCE_READER = Symbol('OPERATIONS_EVENT_REFERENCE_READER');
export const WALK_IN_POLICY_OWNER = Symbol('WALK_IN_POLICY_OWNER');
export const GUEST_PRIVACY_CLASSIFICATION_OWNER = Symbol('GUEST_PRIVACY_CLASSIFICATION_OWNER');
