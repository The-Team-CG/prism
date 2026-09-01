import type { OpsFloorPlanDraft } from '@prisma/client';

export interface FloorplanReader {
  getFloorPlanSnapshot(eventId: string, draftId: string, type?: 'submitted' | 'approved'): Promise<unknown>;
  mapFloorPlanDraft(draft: OpsFloorPlanDraft): unknown;
}