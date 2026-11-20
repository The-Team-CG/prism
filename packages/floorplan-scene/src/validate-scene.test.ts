import { describe, expect, it } from "vitest";
import { SCENE_LIMITS, validateFloorplanScene } from "./validate-scene.js";
import { sceneWith, table } from "./__fixtures__/scenes.js";

function issuesOf(input: unknown): string[] {
  const result = validateFloorplanScene(input);
  return result.ok ? [] : result.issues;
}

describe("validateFloorplanScene", () => {
  it("accepts a site, building, level and table", () => {
    const result = validateFloorplanScene(sceneWith([table("prism-table_a", { guestIds: ["g1"] })]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene.nodes["prism-table_a"]).toMatchObject({ chairStyle: "chiavari", guestIds: ["g1"] });
  });

  it("rejects a scene with more than the node limit", () => {
    const tables = Array.from({ length: SCENE_LIMITS.maxNodes - 2 }, (_, index) => table(`prism-table_${index}`));
    expect(issuesOf(sceneWith(tables)).join(" ")).toContain("too many nodes");
  });

  it("rejects a scene larger than the byte limit", () => {
    const padded = { ...table("prism-table_a"), label: "x".repeat(SCENE_LIMITS.maxBytes) };
    expect(issuesOf(sceneWith([padded])).join(" ")).toContain("too large");
  });

  it("names a node whose parent does not exist", () => {
    const orphan = { ...table("prism-table_orphan"), parentId: "level_missing" };
    expect(issuesOf(sceneWith([orphan])).join(" ")).toContain("prism-table_orphan");
  });

  it("rejects an event piece that breaks its schema", () => {
    expect(issuesOf(sceneWith([table("prism-table_a", { seats: -1 })])).join(" ")).toContain("prism-table_a");
  });

  it("rejects a root node that has a parent and a root id that is missing", () => {
    const scene = sceneWith([]);
    expect(issuesOf({ ...scene, rootNodeIds: ["building_1"] }).join(" ")).toContain("building_1");
    expect(issuesOf({ ...scene, rootNodeIds: ["site_missing"] }).join(" ")).toContain("site_missing");
  });

  it("rejects input that is not a scene document", () => {
    expect(issuesOf({ nodes: [] }).length).toBeGreaterThan(0);
  });
});

describe("validateFloorplanScene with the Library's pieces", () => {
  const base = { parentId: "level_1", position: [1, 0, 1], rotation: 0, width: 3, depth: 3 };

  it("accepts a seating block and refuses a zone without a label", () => {
    const blockNode = { id: "prism-seating-block_a", type: "prism-seating-block", style: "classroom", rows: 3, columns: 4, ...base };
    expect(validateFloorplanScene(sceneWith([blockNode])).ok).toBe(true);
    const zoneNode = { id: "prism-zone_a", type: "prism-zone", label: "", ...base };
    expect(issuesOf(sceneWith([zoneNode])).join(" ")).toContain("prism-zone_a");
  });

  it("refuses an unknown prism piece type", () => {
    expect(issuesOf(sceneWith([{ id: "prism-rocket_a", type: "prism-rocket", ...base }])).join(" ")).toContain("prism-rocket_a");
  });
});
