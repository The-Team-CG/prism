import type { BufferGeometry, Material } from "three";
import type { Recipe } from "@pascal-app/core/procedural-items";

/**
 * What building a piece needs from Pascal at run time: its procedural builder (in `@pascal-app/nodes`) and its material
 * library (in `@pascal-app/viewer`). Both load with the editor, so the editor host provides them with `setDesignRuntime`
 * before any piece is built; the designs themselves stay plain data.
 */
export type DesignRuntime = {
  /** Builds a design at the given values, one geometry per material slot. */
  build(recipe: Recipe, parameters: Record<string, number>): Array<{ slot: string; geometry: BufferGeometry }>;
  /** A shared material for a library reference or colour, at the editor's shading. */
  material(ref: string, shading: string): Material;
};

let runtime: DesignRuntime | null = null;

export function setDesignRuntime(next: DesignRuntime) {
  runtime = next;
}

export function designRuntime(): DesignRuntime {
  if (!runtime) throw new Error("Event pieces are built inside PrismFloorplanEditor, which provides Pascal's builder and materials.");
  return runtime;
}
