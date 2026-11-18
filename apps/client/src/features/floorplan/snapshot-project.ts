import type { FloorplanSceneDocument, PrismFloorPlanSnapshot } from "@prism/types";
import type { Project } from "@prism/floorplan-canvas";

/** Saved arrays pass through unchanged; they are already canonical canvas objects. */
export type ApiFloorPlanSnapshot = Omit<PrismFloorPlanSnapshot, "objects" | "guests" | "suppliers"> &
  Partial<Pick<Project, "objects" | "guests" | "suppliers">>;

/** A saved layout as the client reads it: the Pascal scene it draws from, with no editor state. */
export type ClientPlanLayout = { id: string; name: string; venue: string; scene: FloorplanSceneDocument | null };

export function layoutFromSnapshot(plan: Pick<PrismFloorPlanSnapshot, "id" | "name" | "venue" | "scene">): ClientPlanLayout {
  return { id: plan.id, name: plan.name, venue: plan.venue, scene: plan.scene ?? null };
}

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
