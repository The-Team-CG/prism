import { beforeAll, describe, expect, it } from "vitest";
import { BoxGeometry, InstancedMesh, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { evaluateRecipe, validateDesign } from "@pascal-app/core/procedural-items";
import { placeableEventPieceSchemaFor, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";
import { eventPieceDefaults } from "../event-layout-plugin";
import { LIBRARY_CATALOG } from "../library/catalog";
import { placeNode } from "../tools/place-node";
import { buildEventPiece, designFor, setDesignRuntime } from ".";
import { chairDesign, deskDesign } from "./seating";

/**
 * Stands in for Pascal's runtime. Building uses Pascal's own recipe evaluation, one box per evaluated shape grouped by
 * slot; materials are one per library reference, named after it, so tests can read which look a slot got.
 */
const resolved = new Map<string, MeshStandardMaterial>();
beforeAll(() =>
  setDesignRuntime({
    build: (recipe, parameters) => {
      const slots = [...new Set(evaluateRecipe(recipe, parameters).shapes.map((shape) => shape.slot))];
      return slots.map((slot) => ({ slot, geometry: new BoxGeometry() }));
    },
    material: (ref) => {
      if (!resolved.has(ref)) resolved.set(ref, Object.assign(new MeshStandardMaterial(), { name: ref }));
      return resolved.get(ref)!;
    },
  }),
);

const piece = (type: PrismEventPieceType, fields: Record<string, unknown> = {}): PrismEventPiece =>
  placeableEventPieceSchemaFor(type).parse({ ...eventPieceDefaults(type), parentId: "level", position: [0, 0, 0], ...fields });

const presets = LIBRARY_CATALOG.flatMap(({ items }) => items).map((tile) => placeNode(tile.kind, { ...eventPieceDefaults(tile.kind), ...tile.preset }, [0, 0, 0], {}, "level"));

const meshesOf = (root: Object3D) => root.children.filter((child): child is Mesh => child instanceof Mesh);
const lookOf = (root: Object3D) => new Set(meshesOf(root).map((mesh) => (mesh.material as MeshStandardMaterial).name));

describe("event designs", () => {
  it("are valid Pascal designs for every Library piece", () => {
    const designs = [...presets.flatMap((preset) => (preset.type === "prism-seating-block" ? [chairDesign(), deskDesign(preset)].filter((design) => design !== null) : [designFor(preset)])), chairDesign()];
    for (const { recipe, values } of designs) {
      const validation = validateDesign(recipe, { parameters: values });
      expect(validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error"), recipe.name).toEqual([]);
    }
  });

  it("rings a round table with one chair per seat", () => {
    const { recipe, values } = designFor(piece("prism-table", { shape: "round", seats: 8 }) as Exclude<PrismEventPiece, { type: "prism-seating-block" }>);
    const seats = evaluateRecipe(recipe, values).shapes.filter((shape) => shape.partId === "chairs" && shape.id.endsWith("seat"));
    expect(seats).toHaveLength(8);
  });

  it("builds every Library piece, dressed in its card's linen and chair style", () => {
    for (const preset of presets) expect(buildEventPiece(preset).children.length, preset.type).toBeGreaterThan(0);
    const ivory = lookOf(buildEventPiece(piece("prism-table", { shape: "round", seats: 8, linen: "ivory", chairStyle: "chiavari" })));
    expect(ivory).toContain("library:preset-cream");
    expect(ivory).toContain("library:metal-brass");
  });

  it("draws a 300-seat block as one instanced chair per material", () => {
    const block = buildEventPiece(piece("prism-seating-block", { style: "theater", rows: 15, columns: 20, width: 10, depth: 13.5 }));
    const instanced = block.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
    expect(instanced.length).toBeGreaterThan(0);
    expect(instanced.every((mesh) => mesh.count === 300)).toBe(true);
  });
});
