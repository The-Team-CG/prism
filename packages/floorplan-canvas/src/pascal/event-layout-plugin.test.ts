import { describe, expect, it } from "vitest";
import type { BoxGeometry, CylinderGeometry, Mesh, Object3D } from "three";
import { convertLegacyPlan } from "@prism/floorplan-scene";
import { prismEventPieceTypes, type FloorPlanCanvasObject } from "@prism/types";
import { prismEventLayoutPlugin } from "./event-layout-plugin";

function legacy(fields: Partial<FloorPlanCanvasObject> & Pick<FloorPlanCanvasObject, "id" | "name" | "kind" | "category">): FloorPlanCanvasObject {
  return { x: 4, y: 6, w: 1.8, h: 1.8, rotation: 0, fill: "#fff", stroke: "#000", strokeWidth: 0.04, locked: false, hidden: false, ...fields };
}

const scene = convertLegacyPlan(
  {
    name: "Ballroom",
    widthM: 20,
    heightM: 15,
    objects: [
      legacy({ id: "table_a", name: "Round Banquet (10pax)", kind: "ellipse", category: "furniture", seats: 10, assignedGuestIds: ["g1", "g2"] }),
      legacy({ id: "stage_a", name: "Stage", kind: "rect", category: "stage", w: 6, h: 3 }),
    ],
  },
  "1.1.6",
);

function convertedNode(legacyId: string) {
  const node = Object.values(scene.nodes).find((candidate) => (candidate as { metadata?: { legacyId?: string } }).metadata?.legacyId === legacyId);
  if (!node) throw new Error(`No node converted from ${legacyId}`);
  return node;
}

function definitionOf(kind: string) {
  const definition = prismEventLayoutPlugin.nodes?.find((candidate) => candidate.kind === kind);
  if (!definition) throw new Error(`No definition for ${kind}`);
  return definition;
}

describe("prismEventLayoutPlugin", () => {
  it("registers one definition per PRISM event piece type under its plugin id", () => {
    expect(prismEventLayoutPlugin).toMatchObject({ id: "prism:event-layout", apiVersion: 1 });
    expect(prismEventLayoutPlugin.nodes?.map((definition) => definition.kind).sort()).toEqual([...prismEventPieceTypes].sort());
  });

  it("parses a converted table through the registered schema, keeping its seated guests", () => {
    const table = definitionOf("prism-table").schema.parse(convertedNode("table_a"));
    expect(table).toMatchObject({ type: "prism-table", shape: "round", seats: 10, guestIds: ["g1", "g2"] });
  });

  /** Pascal's geometry system moves the built object's children into the scene, so the shape must be a child. */
  function drawnShape<T>(kind: string, legacyId: string) {
    const built = definitionOf(kind).geometry?.(definitionOf(kind).schema.parse(convertedNode(legacyId)), {} as never) as Object3D | undefined;
    expect(built?.children).toHaveLength(1);
    return built?.children[0] as Mesh<T extends "cylinder" ? CylinderGeometry : BoxGeometry>;
  }

  it("draws a round table as a cylinder of its width and a stage as a box of its footprint, as children Pascal can place", () => {
    expect(drawnShape<"cylinder">("prism-table", "table_a").geometry.parameters).toMatchObject({ radiusTop: 0.9, radiusBottom: 0.9 });
    expect(drawnShape<"box">("prism-stage", "stage_a").geometry.parameters).toMatchObject({ width: 6, depth: 3 });
  });

  it("duplicates a seated table as an empty copy, so the copy never seats the same guests twice", () => {
    const duplicable = definitionOf("prism-table").capabilities.duplicable;
    if (typeof duplicable !== "object" || !duplicable.prepareSubtreeClone) throw new Error("Tables must duplicate through Pascal's subtree clone");
    expect(duplicable.subtree).toBe(true);

    const original = convertedNode("table_a") as never;
    const { root } = duplicable.prepareSubtreeClone({ root: original, descendants: [], rootId: "table" as never, rootPatch: {}, nodes: {} });

    expect(root).toMatchObject({ type: "prism-table", shape: "round", seats: 10, width: 1.8, guestIds: [] });
    expect((root as { metadata?: Record<string, unknown> }).metadata).not.toHaveProperty("legacyId");
  });

  it("numbers a duplicated table after the highest table in the room, keeping a custom label", () => {
    const duplicable = definitionOf("prism-table").capabilities.duplicable;
    if (typeof duplicable !== "object" || !duplicable.prepareSubtreeClone) throw new Error("Tables must duplicate through Pascal's subtree clone");
    const table = (id: string, number: number, label?: string) => ({ ...convertedNode("table_a"), id, number, ...(label === undefined ? { label: undefined } : { label }) });
    const nodes = { a: table("a", 1, "T1"), b: table("b", 7, "T7"), c: table("c", 3, "VIP") } as never;
    const copyOf = (root: object) => duplicable.prepareSubtreeClone!({ root: root as never, descendants: [], rootId: "x" as never, rootPatch: {}, nodes }).root;

    expect(copyOf(table("a", 1, "T1"))).toMatchObject({ number: 8, label: "T8" });
    expect(copyOf(table("c", 3, "VIP"))).toMatchObject({ number: 8, label: "VIP" });
  });

  it("places the 2D footprint at the piece's plan position, turned by its rotation", () => {
    const stageNode = definitionOf("prism-stage").schema.parse({ ...convertedNode("stage_a"), rotation: Math.PI / 2 });
    const footprint = definitionOf("prism-stage").floorplan?.(stageNode, {} as never);
    expect(footprint).toMatchObject({ kind: "group", transform: { translate: [7, 7.5], rotate: -Math.PI / 2 } });
  });
});
