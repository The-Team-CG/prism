import type { PrismFloorPlanSnapshot } from "@prism/types";
import type { Project } from "@prism/floorplan-canvas";

/** Saved arrays pass through unchanged: the API still accepts plans saved in the older canvas shape. */
export type ApiFloorPlanSnapshot = Omit<PrismFloorPlanSnapshot, "objects" | "guests" | "suppliers"> &
  Partial<Pick<Project, "objects" | "guests" | "suppliers">>;

export function projectFromSnapshot(plan: ApiFloorPlanSnapshot): Project {
  const timestamp = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    objects: plan.objects ?? [],
    guests: plan.guests ?? [],
    suppliers: plan.suppliers ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
