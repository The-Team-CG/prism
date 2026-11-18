import type { FloorplanSceneDocument } from "@prism/types";
import type { CanvasObject } from "./types";

/** A venue library entry: a room saved by PMCM from the Pascal editor, whose scene a new draft copies. */
export interface FloorPlanTemplate {
  id: string;
  name: string;
  description?: string;
  venue?: string;
  /** House rules for the venue (load-in hours, noise limits, restricted areas), saved with the library entry. */
  venueRules?: string;
  widthM: number;
  heightM: number;
  pax: number;
  scene: FloorplanSceneDocument | null;
  createdAt: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  venue?: string;
  venueRules?: string;
  pax: number;
  scene: FloorplanSceneDocument;
}

/** Walls, doors, windows, pillars and safety equipment belong to the venue, not to one event's layout. */
export function isPermanentFeature(object: CanvasObject): boolean {
  return object.category === "architecture" || object.category === "safety";
}
