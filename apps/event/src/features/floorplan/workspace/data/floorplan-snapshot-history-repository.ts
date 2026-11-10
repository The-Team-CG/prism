import type { PrismFloorPlanSnapshotVersion } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const floorplanSnapshotHistoryRepository = {
  list(eventId: string, draftId: string): Promise<PrismFloorPlanSnapshotVersion[]> {
    return eventApi.floorplans.history(eventId, draftId);
  },
};
