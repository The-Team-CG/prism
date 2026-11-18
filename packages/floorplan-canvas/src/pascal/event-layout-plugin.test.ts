import { describe, expect, it } from "vitest";
import type { BoxGeometry, CylinderGeometry, Mesh } from "three";
import { convertLegacyPlan } from "@prism/floorplan-scene";
import { prismPieceNodeTypes, type FloorPlanCanvasObject } from "@prism/types";
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
    expect(prismEventLayoutPlugin.nodes?.map((definition) => definition.kind).sort()).toEqual(["prism-table", ...prismPieceNodeTypes].sort());
  });

  it("parses a converted table through the registered schema, keeping its seated guests", () => {
    const table = definitionOf("prism-table").schema.parse(convertedNode("table_a"));
    expect(table).toMatchObject({ type: "prism-table", shape: "round", seats: 10, guestIds: ["g1", "g2"] });
  });

  it("draws a round table as a cylinder of its width and a stage as a box of its footprint", () => {
    const table = definitionOf("prism-table").geometry?.(definitionOf("prism-table").schema.parse(convertedNode("table_a")), {} as never) as Mesh<CylinderGeometry>;
    expect(table.geometry.parameters).toMatchObject({ radiusTop: 0.9, radiusBottom: 0.9 });

    const stage = definitionOf("prism-stage").geometry?.(definitionOf("prism-stage").schema.parse(convertedNode("stage_a")), {} as never) as Mesh<BoxGeometry>;
    expect(stage.geometry.parameters).toMatchObject({ width: 6, depth: 3 });
  });

  it("places the 2D footprint at the piece's plan position, turned by its rotation", () => {
    const stageNode = definitionOf("prism-stage").schema.parse({ ...convertedNode("stage_a"), rotation: Math.PI / 2 });
    const footprint = definitionOf("prism-stage").floorplan?.(stageNode, {} as never);
    expect(footprint).toMatchObject({ kind: "group", transform: { translate: [7, 7.5], rotate: -Math.PI / 2 } });
  });
});
