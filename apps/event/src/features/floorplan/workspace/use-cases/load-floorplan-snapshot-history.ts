import { floorplanSnapshotHistoryRepository } from "../data/floorplan-snapshot-history-repository";

export function loadFloorplanSnapshotHistory(eventId: string, draftId: string) {
  return floorplanSnapshotHistoryRepository.list(eventId, draftId);
}
