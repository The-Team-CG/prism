import { planDrawing, roomSize, type PlanDrawing } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument } from "@prism/types";

/** The 2D drawing of a saved scene, or null when the plan has no scene or no walls to draw its room from. */
export function drawingOfScene(scene: FloorplanSceneDocument | null | undefined): PlanDrawing | null {
  return scene && roomSize(scene) ? planDrawing(scene) : null;
}
