import type {
  PrismClientFloorplanSnapshotType,
  PrismClientSharedFloorplanEntry,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import { clientSharedFloorplansRepository } from "../data/client-shared-floorplans-repository";

export function listClientSharedFloorplans(): Promise<PrismClientSharedFloorplanEntry[]> {
  return clientSharedFloorplansRepository.listSharedFloorplans();
}

export async function loadClientSharedFloorplanSnapshot(
  eventId: string,
  draftId: string,
  snapshotType: PrismClientFloorplanSnapshotType,
): Promise<{ entry: PrismClientSharedFloorplanEntry; project: Project }> {
  const entries = await clientSharedFloorplansRepository.listSharedFloorplans();
  const entry = entries.find((candidate) =>
    candidate.eventId === eventId
    && candidate.draftId === draftId
    && candidate.availableSnapshots.includes(snapshotType));
  if (!entry) throw new Error("This shared floorplan snapshot is no longer available.");

  const project = await clientSharedFloorplansRepository.loadSnapshot(eventId, draftId, snapshotType);
  return { entry, project };
}
