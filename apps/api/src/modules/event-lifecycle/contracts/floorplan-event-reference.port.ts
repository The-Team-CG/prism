import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

/** Lifecycle-owned facts Floorplan needs to authorize and project event work. */
export type FloorplanEventReference = {
  eventId: string;
  eventName: string;
  clientName: string;
  clientPortalStatus: string;
  archived: boolean;
  freezeStatus: string;
  floorPlanStatus: string;
  readiness: string;
  primaryClientEmail: string | null;
  conformeSigned: boolean;
  ocularVisitStatus: string | null;
};

/** Reads Lifecycle state and locks it when called from an event-scoped Floorplan write. */
export interface FloorplanEventReferenceReader {
  findFloorplanEvent(eventId: string, transaction?: PrismTransactionContext): Promise<FloorplanEventReference | null>;
}

export const FLOORPLAN_EVENT_REFERENCE_READER = Symbol('FLOORPLAN_EVENT_REFERENCE_READER');
