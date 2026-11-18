import { describe, expect, it } from "vitest";
import type { FloorPlanCanvasObject, FloorplanSceneDocument } from "@prism/types";
import { convertLegacyPlan } from "./convert-legacy-plan.js";
import { validateFloorplanScene } from "./validate-scene.js";
import { legacyAssets } from "./__fixtures__/legacy-plans.js";

type Node = FloorplanSceneDocument["nodes"][string] & Record<string, unknown>;

function convert(objects: FloorPlanCanvasObject[]) {
  return convertLegacyPlan({ name: "Ballroom", widthM: 20, heightM: 15, objects }, "1.1.6");
}

function nodeFor(scene: FloorplanSceneDocument, legacyId: string): Node {
  const node = Object.values(scene.nodes).find((candidate) => (candidate as Node & { metadata?: { legacyId?: string } }).metadata?.legacyId === legacyId);
  if (!node) throw new Error(`No node converted from ${legacyId}`);
  return node as Node;
}

describe("convertLegacyPlan", () => {
  it("places a seated round banquet at its centre with its guests and table number", () => {
    const table = nodeFor(convert([legacyAssets.roundBanquet]), "round-banquet_a");
    expect(table).toMatchObject({ type: "prism-table", shape: "round", position: [2.9, 0, 3.9], seats: 10, guestIds: ["g1"], number: 12, label: "T12" });
  });

  it("turns a legacy wall into a Pascal wall along its long side", () => {
    expect(nodeFor(convert([legacyAssets.wall]), "wall_a")).toMatchObject({ type: "wall", start: [0, 0.1], end: [4, 0.1], thickness: 0.2 });
  });

  it("runs a rotated wall's ends along its turned long side", () => {
    const wall = nodeFor(convert([{ ...legacyAssets.wall, rotation: Math.PI / 2 }]), "wall_a");
    const [start, end] = [wall.start as number[], wall.end as number[]];
    expect(start[0]).toBeCloseTo(2, 9);
    expect(start[1]).toBeCloseTo(-1.9, 9);
    expect(end[0]).toBeCloseTo(2, 9);
    expect(end[1]).toBeCloseTo(2.1, 9);
  });

  it("turns a clockwise legacy rotation into the opposite rotation about the vertical axis", () => {
    expect(nodeFor(convert([legacyAssets.vipTable]), "vip-table_a").rotation).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("keeps a hidden, locked chair hidden and locked", () => {
    expect(nodeFor(convert([legacyAssets.chair]), "chair_a")).toMatchObject({ type: "prism-seat", visible: false, locked: true });
  });

  it("keeps the label of a line and of an unrecognised piece, and gives a zero-size piece a size", () => {
    const scene = convert([legacyAssets.line, legacyAssets.labelledRect]);
    expect(nodeFor(scene, "draw_1")).toMatchObject({ type: "prism-shape", variant: "line", label: "Cable run" });
    const unknown = nodeFor(scene, "draw_2");
    expect(unknown).toMatchObject({ type: "prism-decor", variant: "mystery", label: "Sign here" });
    expect(unknown.depth).toBeGreaterThan(0);
  });

  it.each([
    ["cocktail", "prism-table", { shape: "cocktail", seats: 0 }],
    ["buffet", "prism-catering", { variant: "buffet", supplierIds: ["s1"] }],
    ["stage", "prism-stage", {}],
    ["ledWall", "prism-av", { variant: "led-wall" }],
    ["registrationDesk", "prism-registration", {}],
    ["booth", "prism-booth", {}],
    ["photoWall", "prism-decor", { variant: "photo-wall" }],
    ["fireExtinguisher", "prism-safety", { variant: "fire-extinguisher" }],
    ["pillar", "column", { position: [1.3, 0, 1.3], crossSection: "rectangular", width: 0.6, depth: 0.6 }],
    ["door", "prism-fixture", { variant: "door", locked: true }],
  ] as const)("maps the legacy %s to %s", (asset, type, fields) => {
    const object = legacyAssets[asset];
    expect(nodeFor(convert([object]), object.id)).toMatchObject({ type, ...fields });
  });

  it("produces a valid scene with one node per object plus the room skeleton, every child listed by its parent", () => {
    const objects = Object.values(legacyAssets);
    const scene = convert(objects);

    const validation = validateFloorplanScene(scene);
    expect(validation.ok ? [] : validation.issues).toEqual([]);
    expect(Object.keys(scene.nodes)).toHaveLength(objects.length + 7);
    expect(scene.rootNodeIds).toHaveLength(1);
    for (const node of Object.values(scene.nodes)) {
      if (node.parentId === null) continue;
      expect((scene.nodes[node.parentId] as Node).children).toContain(node.id);
    }
  });
});
