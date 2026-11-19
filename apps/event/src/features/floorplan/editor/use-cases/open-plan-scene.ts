import { convertLegacyPlan, matchLegacyGuests } from "@prism/floorplan-scene";
import type { FloorPlanCanvasObject, FloorPlanGuest, FloorplanSceneDocument, PrismFloorplanSeatingGuest } from "@prism/types";

export type PlanToOpen = {
  scene: FloorplanSceneDocument | null;
  name: string;
  widthM: number;
  heightM: number;
  objects: FloorPlanCanvasObject[];
  /** The legacy plan's own guest list, which its seats name. */
  guests: FloorPlanGuest[];
};

export type OpenedPlanScene = { scene: FloorplanSceneDocument; converted: boolean; unmatchedSeats: number };

/**
 * Seats on a converted plan name the legacy plan's guests; the editor seats the event roster. Each legacy guest
 * becomes the roster guest with exactly the same name (the API compares a first save the same way). A seat whose guest
 * matches nobody, or whose roster guest is already seated, is left empty and counted.
 */
function seatRosterGuests(scene: FloorplanSceneDocument, legacyGuests: readonly FloorPlanGuest[], roster: readonly PrismFloorplanSeatingGuest[]) {
  const rosterIdOf = matchLegacyGuests(legacyGuests, roster);
  const seated = new Set<string>();
  let unmatchedSeats = 0;
  const nodes = Object.fromEntries(
    Object.entries(scene.nodes).map(([id, node]) => {
      if (node.type !== "prism-table" || !Array.isArray(node.guestIds)) return [id, node];
      const guestIds = (node.guestIds as string[]).flatMap((legacyId) => {
        const rosterId = rosterIdOf.get(legacyId);
        if (!rosterId || seated.has(rosterId)) {
          unmatchedSeats += 1;
          return [];
        }
        seated.add(rosterId);
        return [rosterId];
      });
      return [id, { ...node, guestIds }];
    }),
  );
  return { scene: { ...scene, nodes }, unmatchedSeats };
}

/**
 * The scene the Pascal editor opens: the stored scene, or the legacy plan converted on open with its seats moved to
 * the event roster. A converted scene is stored by the editor's first save; until then the legacy columns are all
 * the plan has, so a second open before that save reports the unmatched seats again.
 */
export function openPlanScene(plan: PlanToOpen, pascalVersion: string, roster: readonly PrismFloorplanSeatingGuest[]): OpenedPlanScene {
  if (plan.scene) return { scene: plan.scene, converted: false, unmatchedSeats: 0 };
  const converted = convertLegacyPlan({ name: plan.name, widthM: plan.widthM, heightM: plan.heightM, objects: plan.objects }, pascalVersion);
  return { ...seatRosterGuests(converted, plan.guests, roster), converted: true };
}
