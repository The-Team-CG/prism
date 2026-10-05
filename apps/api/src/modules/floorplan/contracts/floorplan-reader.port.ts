import type { OpsFloorPlanDraft } from '@prisma/client';
import type { PrismClientSharedFloorplanEntry } from '@prism/types';

export interface FloorplanReader {
  listClientSnapshotEntries(
    eventIds: string[],
  ): Promise<Array<Omit<PrismClientSharedFloorplanEntry, 'eventName' | 'eventDate'>>>;
  getFloorPlanSnapshot(eventId: string, draftId: string, type?: 'submitted' | 'approved'): Promise<unknown>;
  mapFloorPlanDraft(draft: OpsFloorPlanDraft): unknown;
}