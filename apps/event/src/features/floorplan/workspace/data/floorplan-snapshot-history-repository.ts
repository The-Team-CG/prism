import type { PrismFloorPlanSnapshotVersion } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const floorplanSnapshotHistoryRepository = {
  list(eventId: string, draftId: string): Promise<PrismFloorPlanSnapshotVersion[]> {
    return eventApiRequest(`/events/${encodeURIComponent(eventId)}/floorplans/${encodeURIComponent(draftId)}/history`);
  },
};
