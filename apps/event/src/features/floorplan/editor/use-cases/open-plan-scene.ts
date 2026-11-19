import { convertLegacyPlan } from "@prism/floorplan-scene";
import type { FloorPlanCanvasObject, FloorplanSceneDocument } from "@prism/types";

export type PlanToOpen = {
  scene: FloorplanSceneDocument | null;
  name: string;
  widthM: number;
  heightM: number;
  objects: FloorPlanCanvasObject[];
};

/**
 * The scene the Pascal editor opens: the stored scene, or the legacy plan converted on open. A converted scene is
 * stored by the editor's first save; until then the legacy columns are all the plan has.
 */
export function openPlanScene(plan: PlanToOpen, pascalVersion: string): { scene: FloorplanSceneDocument; converted: boolean } {
  if (plan.scene) return { scene: plan.scene, converted: false };
  return { scene: convertLegacyPlan({ name: plan.name, widthM: plan.widthM, heightM: plan.heightM, objects: plan.objects }, pascalVersion), converted: true };
}
