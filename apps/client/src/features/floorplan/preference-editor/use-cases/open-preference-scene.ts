import { convertLegacyPlan, withoutSeatedGuests } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument } from "@prism/types";
import type { PreferencePlan } from "../data/preference-plan-repository";

/**
 * The scene a preference opens in. A preference the client has already saved opens as saved. A new one starts from the
 * official layout, copied without its seated guests, which are the event team's to seat; with no official layout it
 * starts from a blank room of the plan's size.
 */
export function openingScene(plan: PreferencePlan, officialScene: FloorplanSceneDocument | null, pascalVersion: string): FloorplanSceneDocument {
  if (plan.scene) return plan.scene;
  if (officialScene) return withoutSeatedGuests(officialScene);
  return convertLegacyPlan({ name: plan.name, widthM: plan.widthM, heightM: plan.heightM, objects: [] }, pascalVersion);
}
