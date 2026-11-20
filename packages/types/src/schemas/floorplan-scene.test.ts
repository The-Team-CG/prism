import { describe, expect, it } from "vitest";
import { floorplanSceneDocumentSchema, placeableEventPieceSchemaFor, prismEventPieceSchemaFor, prismEventPieceTypes, prismTableNodeSchema } from "./floorplan-scene.js";
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

describe("event pieces added for the Library", () => {
  const placement = { parentId: "level_1", position: [1, 0, 2], rotation: 0, width: 4, depth: 3 };

  it.each([
    ["prism-seating-block", { style: "theater", rows: 5, columns: 4, aisle: 1.2 }, { rows: 0 }],
    ["prism-dance-floor", {}, { width: 0 }],
    ["prism-bar", { shape: "l" }, { shape: "round" }],
    ["prism-zone", { label: "Catering BOH", supplierIds: ["sup_1"] }, { label: "" }],
  ] as const)("parses a valid %s and rejects a broken one", (type, fields, broken) => {
    const schema = prismEventPieceSchemaFor(type);
    const node = { id: `${type}_a`, type, ...placement, ...fields };
    expect(schema.parse(node)).toMatchObject({ type });
    expect(schema.safeParse({ ...node, ...broken }).success).toBe(false);
  });

  it("covers every event piece type", () => {
    for (const type of prismEventPieceTypes) expect(prismEventPieceSchemaFor(type).shape.type).toBeDefined();
  });

  it("gives a piece placed without an id one named after its type, as Pascal's tools parse new nodes without ids", () => {
    const placed = placeableEventPieceSchemaFor("prism-table").parse({ type: "prism-table", shape: "round", seats: 8, ...placement });
    expect(placed.id).toMatch(/^prism-table_[0-9a-f-]{36}$/);
  });
});
