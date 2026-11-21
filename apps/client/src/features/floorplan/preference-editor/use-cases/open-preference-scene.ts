import { convertLegacyPlan, withoutEventAssignments } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument } from "@prism/types";
import type { PreferencePlan } from "../data/preference-plan-repository";

/**
 * Whether the client has laid anything out yet. A preference starts as a blank room, so a scene with no event pieces
 * (tables, stage, zones) is one the client never drew in and still opens from the official layout.
 */
export function hasPreferenceLayout(scene: FloorplanSceneDocument | null | undefined): scene is FloorplanSceneDocument {
  return Boolean(scene && Object.values(scene.nodes).some((node) => node.type.startsWith("prism-")));
}

/**
 * The scene a preference opens in. A preference the client has already saved opens as saved. A new one starts from the
 * official layout, copied without its seated guests, which are the event team's to seat; with no official layout it
 * starts from a blank room of the plan's size.
 */
export function openingScene(plan: PreferencePlan, officialScene: FloorplanSceneDocument | null, pascalVersion: string): FloorplanSceneDocument {
  if (hasPreferenceLayout(plan.scene)) return plan.scene;
  if (officialScene) return withoutEventAssignments(officialScene);
  if (plan.scene) return plan.scene;
  return convertLegacyPlan({ name: plan.name, widthM: plan.widthM, heightM: plan.heightM, objects: [] }, pascalVersion);
}
