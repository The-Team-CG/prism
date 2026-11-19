import { describe, expect, it } from "vitest";
import { floorplanSceneDocumentSchema, prismTableNodeSchema } from "./floorplan-scene.js";
import { updatePlanSchema } from "./session-spatial-inputs.js";
import { prismFloorPlanSnapshotSchema } from "./floorplan-inputs.js";

const minimalScene = {
  format: "pascal-v1",
  pascalVersion: "1.1.6",
  nodes: { site_a: { id: "site_a", type: "site", parentId: null, polygon: { type: "polygon", points: [] } } },
  rootNodeIds: ["site_a"],
};

describe("floor plan scene document", () => {
  it("accepts a minimal pascal-v1 document and keeps Pascal's own node fields", () => {
    const parsed = floorplanSceneDocumentSchema.parse(minimalScene);
    expect(parsed.nodes.site_a).toMatchObject({ type: "site", visible: true, polygon: { type: "polygon" } });
  });

  it("round-trips Pascal's optional scene fields", () => {
    const scene = { ...minimalScene, collections: { c1: { id: "c1" } }, materials: { m1: { id: "m1" } }, installedPlugins: ["prism:event-layout"] };
    expect(floorplanSceneDocumentSchema.parse(scene)).toMatchObject({ collections: { c1: { id: "c1" } }, materials: { m1: { id: "m1" } }, installedPlugins: ["prism:event-layout"] });
  });

  it("rejects another format", () => {
    expect(floorplanSceneDocumentSchema.safeParse({ ...minimalScene, format: "pascal-v2" }).success).toBe(false);
  });
});

describe("event table node", () => {
  const table = { id: "prism-table_a", type: "prism-table", parentId: "level_1", shape: "round", position: [1, 0, 2], rotation: 0, width: 1.8, depth: 1.8, seats: 10 };

  it("fills table defaults", () => {
    expect(prismTableNodeSchema.parse(table)).toMatchObject({ guestIds: [], supplierIds: [], chairStyle: "chiavari", linen: "white", locked: false, visible: true });
  });

  it("rejects duplicate guest ids and negative seats", () => {
    expect(prismTableNodeSchema.safeParse({ ...table, guestIds: ["g1", "g1"] }).success).toBe(false);
    expect(prismTableNodeSchema.safeParse({ ...table, seats: -1 }).success).toBe(false);
  });
});

describe("plan saves and snapshots carry scenes", () => {
  it("accepts a scene on a plan save", () => {
    const parsed = updatePlanSchema.parse({ expectedUpdatedAt: "2026-11-19T00:00:00.000Z", scene: minimalScene });
    expect(parsed.scene?.format).toBe("pascal-v1");
  });

  it("keeps the scene and its format on a snapshot", () => {
    const parsed = prismFloorPlanSnapshotSchema.parse({ id: "fp1", name: "Plan", venue: "", width: 40, height: 26, gridSize: 1, pax: 0, scene: minimalScene, sceneFormat: "pascal-v1" });
    expect(parsed.sceneFormat).toBe("pascal-v1");
    expect(parsed.scene?.rootNodeIds).toEqual(["site_a"]);
  });
});
