import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  type PrismClientFloorplanSnapshotType,
  type PrismClientSharedFloorplanEntry,
  type PrismFloorPlanSnapshot,
  type PrismUser,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import { clientApiRequest } from "@/lib/prism-api";

type ClientSession = PrismUser & { signedInAt: string };
type ApiFloorPlanSnapshot = Omit<PrismFloorPlanSnapshot, "objects" | "guests" | "suppliers"> &
  Pick<Project, "objects" | "guests" | "suppliers">;

function toProject(plan: ApiFloorPlanSnapshot): Project {
  const timestamp = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    objects: plan.objects ?? [],
    guests: plan.guests ?? [],
    suppliers: plan.suppliers ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

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
    return toProject(plan);
  },
};
