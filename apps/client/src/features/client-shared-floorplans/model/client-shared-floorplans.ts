import type { PrismClientFloorplanSnapshotType } from "@prism/types";

export function isClientFloorplanSnapshotType(
  value: string,
): value is PrismClientFloorplanSnapshotType {
  return value === "submitted" || value === "approved";
}

export function clientSharedFloorplanSnapshotHref(
  eventId: string,
  draftId: string,
  snapshotType: PrismClientFloorplanSnapshotType,
): string {
  return `/dashboard/shared-floorplans/${encodeURIComponent(eventId)}/${encodeURIComponent(draftId)}/${snapshotType}`;
}
