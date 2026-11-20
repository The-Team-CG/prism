import type { FloorplanSceneDocument } from "@prism/types";

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
