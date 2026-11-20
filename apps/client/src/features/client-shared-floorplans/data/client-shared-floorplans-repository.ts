import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  type PrismFloorPlanSnapshot,
  type PrismClientFloorplanSnapshotType,
  type PrismClientSharedFloorplanEntry,
  type PrismUser,
} from "@prism/types";
import { clientApi } from "@/lib/prism-api";
import { layoutFromSnapshot, type ClientPlanLayout } from "@/features/floorplan/snapshot-project";

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
  ): Promise<ClientPlanLayout> {
    const plan = await clientApi.clientPortal.floorplanSnapshot<PrismFloorPlanSnapshot>(eventId, draftId, snapshotType);
    return layoutFromSnapshot(plan);
  },
};
