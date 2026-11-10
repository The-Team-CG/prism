import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  type PrismClientFloorplanSnapshotType,
  type PrismClientSharedFloorplanEntry,
  type PrismUser,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import { clientApi } from "@/lib/prism-api";
import { projectFromSnapshot, type ApiFloorPlanSnapshot } from "@/features/floorplan/snapshot-project";

type ClientSession = PrismUser & { signedInAt: string };
export const clientSharedFloorplansRepository = {
  readSession(): ClientSession | null {
    return readPrismSession<ClientSession>(PRISM_SESSION_STORAGE_KEYS.client);
  },

  listSharedFloorplans(): Promise<PrismClientSharedFloorplanEntry[]> {
    return clientApi.clientPortal.sharedFloorplans();
  },

  async loadSnapshot(
    eventId: string,
    draftId: string,
    snapshotType: PrismClientFloorplanSnapshotType,
  ): Promise<Project> {
    const plan = await clientApi.clientPortal.floorplanSnapshot<ApiFloorPlanSnapshot>(eventId, draftId, snapshotType);
    return projectFromSnapshot(plan);
  },
};
