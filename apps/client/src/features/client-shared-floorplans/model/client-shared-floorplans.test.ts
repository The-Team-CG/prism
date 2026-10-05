import { describe, expect, it } from "vitest";
import {
  clientSharedFloorplanSnapshotHref,
  isClientFloorplanSnapshotType,
} from "./client-shared-floorplans";

describe("client shared floorplan route model", () => {
  it("accepts only the two official snapshot types", () => {
    expect(isClientFloorplanSnapshotType("submitted")).toBe(true);
    expect(isClientFloorplanSnapshotType("approved")).toBe(true);
    expect(isClientFloorplanSnapshotType("raw")).toBe(false);
    expect(isClientFloorplanSnapshotType("preference")).toBe(false);
  });

  it("encodes route identifiers and preserves the snapshot type", () => {
    expect(clientSharedFloorplanSnapshotHref("evt/1", "draft 1", "approved"))
      .toBe("/dashboard/shared-floorplans/evt%2F1/draft%201/approved");
  });
});
