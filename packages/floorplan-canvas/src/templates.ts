import type { CanvasObject, Guest, Supplier } from "./types";
import { uid } from "./assetLibrary";

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
  objects: CanvasObject[];
  includeGuests: boolean;
  includeSuppliers: boolean;
  guests: Guest[];
  suppliers: Supplier[];
  createdAt: number;
}

export type CreateTemplateInput = Omit<FloorPlanTemplate, "id" | "createdAt">;

/** Walls, doors, windows, pillars and safety equipment belong to the venue, not to one event's layout. */
export function isPermanentFeature(object: CanvasObject): boolean {
  return object.category === "architecture" || object.category === "safety";
}

/** How many of a template's objects are venue fixtures that come back locked on reuse. */
export function permanentFeatureCount(template: Pick<FloorPlanTemplate, "objects">): number {
  return template.objects.filter(isPermanentFeature).length;
}

// Clone objects with fresh ids so reuse in a new project doesn't collide.
export function cloneTemplateObjects(t: FloorPlanTemplate): CanvasObject[] {
  return t.objects.map((o) => ({
    ...o,
    id: uid("obj"),
    // Venue fixtures cannot be dragged around by accident once the library puts them on the canvas.
    locked: isPermanentFeature(o) ? true : o.locked,
    assignedGuestIds: [],
    assignedSupplierIds: [],
  }));
}
