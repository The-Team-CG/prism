import type { CanvasObject, Guest, Supplier } from "./types";
import { uid } from "./assetLibrary";

export interface FloorPlanTemplate {
  id: string;
  name: string;
  description?: string;
  venue?: string;
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

// Clone objects with fresh ids so reuse in a new project doesn't collide.
export function cloneTemplateObjects(t: FloorPlanTemplate): CanvasObject[] {
  return t.objects.map((o) => ({
    ...o,
    id: uid("obj"),
    assignedGuestIds: [],
    assignedSupplierIds: [],
  }));
}
