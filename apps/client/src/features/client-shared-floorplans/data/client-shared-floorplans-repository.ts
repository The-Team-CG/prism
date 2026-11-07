import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  type PrismClientFloorplanSnapshotType,
  type PrismClientSharedFloorplanEntry,
  type PrismUser,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import { clientApiRequest } from "@/lib/prism-api";
import { projectFromSnapshot, type ApiFloorPlanSnapshot } from "@/features/floorplan/snapshot-project";

type ClientSession = PrismUser & { signedInAt: string };
export const clientSharedFloorplansRepository = {
  readSession(): ClientSession | null {
    return readPrismSession<ClientSession>(PRISM_SESSION_STORAGE_KEYS.client);
  },

  listSharedFloorplans(): Promise<PrismClientSharedFloorplanEntry[]> {
    return clientApiRequest<PrismClientSharedFloorplanEntry[]>("/client/shared-floorplans");
  },

  async loadSnapshot(
    eventId: string,
    draftId: string,
    snapshotType: PrismClientFloorplanSnapshotType,
  ): Promise<Project> {
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(
      `/events/${encodeURIComponent(eventId)}/floorplans/${encodeURIComponent(draftId)}/snapshot?type=${snapshotType}`,
    );
    return projectFromSnapshot(plan);
  },
};
