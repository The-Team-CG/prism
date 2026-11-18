import type { FloorplanSceneDocument, PrismFloorPlanSnapshot } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

/** A client's preference plan as the Pascal editor opens it: its stored scene and the version to save against. */
export type PreferencePlan = {
  name: string;
  widthM: number;
  heightM: number;
  scene: FloorplanSceneDocument | null;
  updatedAt: string;
};

function versionOf(plan: { id: string; updatedAt?: string }): string {
  if (!plan.updatedAt) throw new Error(`Floor plan ${plan.id} came back without its version`);
  return plan.updatedAt;
}

export async function loadPreferencePlan(planId: string): Promise<PreferencePlan> {
  const plan = await clientApi.floorplans.plan<PrismFloorPlanSnapshot>(planId);
  return { name: plan.name, widthM: plan.width, heightM: plan.height, scene: plan.scene ?? null, updatedAt: versionOf({ id: planId, updatedAt: plan.updatedAt }) };
}

/** Saves the client's scene against the version it was loaded or last saved at. The API refuses a client save on any other draft. */
export async function savePreferenceScene(planId: string, scene: FloorplanSceneDocument, expectedUpdatedAt: string): Promise<{ updatedAt: string }> {
  const saved = await clientApi.floorplans.savePlan<PrismFloorPlanSnapshot>(planId, { expectedUpdatedAt, scene });
  return { updatedAt: versionOf({ id: planId, updatedAt: saved.updatedAt }) };
}
