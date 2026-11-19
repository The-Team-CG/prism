import type { FloorplanSceneDocument, PrismFloorPlanSnapshot } from "@prism/types";

/** A saved layout as the client reads it: the Pascal scene it draws from, with no editor state. */
export type ClientPlanLayout = { id: string; name: string; venue: string; scene: FloorplanSceneDocument | null };

export function layoutFromSnapshot(plan: Pick<PrismFloorPlanSnapshot, "id" | "name" | "venue" | "scene">): ClientPlanLayout {
  return { id: plan.id, name: plan.name, venue: plan.venue, scene: plan.scene ?? null };
}
