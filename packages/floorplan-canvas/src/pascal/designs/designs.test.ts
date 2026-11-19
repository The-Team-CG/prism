import { beforeAll, describe, expect, it } from "vitest";
import { BoxGeometry, InstancedMesh, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { evaluateRecipe, validateDesign } from "@pascal-app/core/procedural-items";
import { CHAIR_STYLES } from "../dressing";
import { placeableEventPieceSchemaFor, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";
import { eventPieceDefaults } from "../event-layout-plugin";
import { LIBRARY_CATALOG } from "../library/catalog";
import { placeNode } from "../tools/place-node";
import { buildEventPiece, designFor, setDesignRuntime } from ".";
import { chairDesign, deskDesign, runnerDesign } from "./seating";

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

const chairCount = (root: Object3D) => Math.max(0, ...root.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh).map((mesh) => mesh.count));

describe("event designs", () => {
  it("are valid Pascal designs for every Library piece and every chair style", () => {
    const designs = [
      ...presets.flatMap((preset) =>
        preset.type === "prism-seating-block" ? [deskDesign(preset), runnerDesign(preset)].filter((design) => design !== null) : [designFor(preset)],
      ),
      ...CHAIR_STYLES.flatMap((style) => [chairDesign(style, false), chairDesign(style, true)]),
    ];
    for (const { recipe, values } of designs) {
      const validation = validateDesign(recipe, { parameters: values });
      expect(validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error"), recipe.name).toEqual([]);
    }
  });

  it.each([
    ["a round table", { shape: "round", seats: 8 }, 8],
    ["a crescent", { shape: "round", seats: 6, crescent: true }, 6],
    ["a presidential table", { shape: "rect", width: 4.8, depth: 0.75, seats: 8, seatSides: "one" }, 8],
    ["a boardroom table", { shape: "rect", width: 4.8, depth: 1.2, seats: 12, seatSides: "around" }, 12],
    ["a U-shape", { shape: "u-shape", width: 6, depth: 5, seats: 18 }, 18],
    ["a hollow square", { shape: "hollow-square", width: 6, depth: 6, seats: 24 }, 24],
  ])("seats %s with one chair per seat", (_name, fields, seats) => {
    expect(chairCount(buildEventPiece(piece("prism-table", fields)))).toBe(seats);
  });

  it("builds every Library piece, dressed in its card's linen, overlay, sash and chair style", () => {
    for (const preset of presets) expect(buildEventPiece(preset).children.length, preset.type).toBeGreaterThan(0);
    const dressed = lookOf(buildEventPiece(piece("prism-table", { shape: "round", seats: 8, linen: "ivory", chairStyle: "chiavari", overlay: "blush", sash: "gold" })));
    for (const ref of ["library:preset-cream", "library:metal-brass", "library:preset-blush", "library:preset-gold"]) expect(dressed).toContain(ref);
    expect(lookOf(buildEventPiece(piece("prism-table", { shape: "round", seats: 8, overlay: "none" })))).not.toContain("library:preset-gold");
  });

  it("draws a 300-seat block as one instanced chair per material", () => {
    const block = buildEventPiece(piece("prism-seating-block", { style: "theater", rows: 15, columns: 20, width: 10, depth: 13.5 }));
    const instanced = block.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
    expect(instanced.length).toBeGreaterThan(0);
    expect(instanced.every((mesh) => mesh.count === 300)).toBe(true);
  });
});
