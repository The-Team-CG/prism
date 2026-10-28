import type { OpsEvent, OpsFloorPlanDraft } from '@prisma/client';

export type GuestAccessEventCandidate = Pick<OpsEvent, 'id' | 'eventName' | 'eventDate' | 'actualEndedAt' | 'updatedAt' | 'archived'>;

export type GuestEventProjection = Pick<OpsEvent,
  'id' | 'eventName' | 'eventDate' | 'status' | 'archived' | 'actualEndedAt' |
  'walkInPolicy' | 'walkInThreshold' | 'clientName' | 'readiness' | 'floorPlanStatus' |
  'floorPlanId' | 'updatedAt'
> & {
  floorPlanDrafts: Array<Pick<OpsFloorPlanDraft, 'id' | 'floorPlanId' | 'isActive'>>;
  /** Latest briefing only: the attendee-safe venue and confirmed start time shown on the guest pass. */
  briefings?: Array<{ venue: string; confirmedStartTime: string | null }>;
};

export type CoordinatorWorkspaceEventProjection = Pick<OpsEvent,
  'id' | 'inquiryId' | 'clientName' | 'eventName' | 'eventDate' | 'status' |
  'clientPortalStatus' | 'readiness' | 'archived' | 'floorPlanStatus' | 'floorPlanId'
> & {
  floorPlanDrafts: OpsFloorPlanDraft[];
  briefings: Array<{ venue: string }>;
};

/** Read-only Lifecycle/Floorplan composition used by Operations event screens. */
export interface GuestEventProjectionReader {
  listGuestAccessCandidates(includeArchived: boolean): Promise<GuestAccessEventCandidate[]>;
  findGuestEvent(eventId: string): Promise<GuestEventProjection | null>;
  listCoordinatorWorkspaceEvents(eventIds: readonly string[]): Promise<CoordinatorWorkspaceEventProjection[]>;
}

export const GUEST_EVENT_PROJECTION_READER = Symbol('GUEST_EVENT_PROJECTION_READER');
