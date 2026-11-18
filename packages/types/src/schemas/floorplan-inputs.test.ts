import { describe, expect, it } from "vitest";
import { floorPlanSnapshotQuerySchema } from "./floorplan-inputs";

describe("floorplan snapshot query schema", () => {
  it("allows the snapshot type alongside client actor query fields", () => {
    const result = floorPlanSnapshotQuerySchema.safeParse({
      type: "approved",
      actorRole: "client",
      actorName: "Ana Reyes",
      actorEmail: "ana@ayala.test",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown snapshot type, an invalid actor email or role, and unknown query keys", () => {
    expect(floorPlanSnapshotQuerySchema.safeParse({ type: "draft" }).success).toBe(false);
    expect(floorPlanSnapshotQuerySchema.safeParse({ actorEmail: "not-an-email" }).success).toBe(false);
    expect(floorPlanSnapshotQuerySchema.safeParse({ actorRole: "admin" }).success).toBe(false);
    expect(floorPlanSnapshotQuerySchema.safeParse({ type: "approved", unexpected: "x" }).success).toBe(false);
  });
});
