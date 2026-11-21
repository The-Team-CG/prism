import { eventApi as eventOpsClient } from "@/lib/prism-api";
import type { PrismEventPrivacy, CreateFloorPlanDraftInput, FloorplanSceneDocument, UpdatePlanInput } from "@prism/types";

interface ApiFloorPlan {
  id: string;
  pax: number;
  eventPrivacy: PrismEventPrivacy;
  scene: FloorplanSceneDocument;
  updatedAt?: string;
  draftStatus?: string | null;
}

/** A plan as the Pascal editor opens it: its stored scene, the guest count and privacy that decide seating, and its version. */
export interface PlanSceneToOpen {
  scene: FloorplanSceneDocument;
  pax: number;
  eventPrivacy: PrismEventPrivacy;
  updatedAt: string;
  /** The draft's status as stored now, which may have moved on (submitted elsewhere) since the editor last opened it. */
  draftStatus: string | null;
}

function planVersion(plan: ApiFloorPlan): string {
  if (!plan.updatedAt) throw new Error(`Floor plan ${plan.id} came back without its version`);
  return plan.updatedAt;
}

export const floorplanCommands = {
approveFloorPlanDraft: (eventId: string, draftId: string) => eventOpsClient.floorplans.approveDraft(eventId, draftId),
reopenClientPreference: (eventId: string, draftId: string) => eventOpsClient.floorplans.reopenPreference(eventId, draftId),
createFloorPlanDraft: (eventId: string, input: CreateFloorPlanDraftInput) => eventOpsClient.floorplans.createDraft(eventId, input),
loadPlanScene: (planId: string): Promise<PlanSceneToOpen> =>
    eventOpsClient.floorplans.plan<ApiFloorPlan>(planId).then((plan) => ({ scene: plan.scene, pax: plan.pax, eventPrivacy: plan.eventPrivacy, updatedAt: planVersion(plan), draftStatus: plan.draftStatus ?? null })),
/** Saves a Pascal scene against the version it was loaded or last saved at. */
savePlanScene: (planId: string, scene: FloorplanSceneDocument, expectedUpdatedAt: string) => {
    const body: UpdatePlanInput = { expectedUpdatedAt, scene };
    return eventOpsClient.floorplans.savePlan<ApiFloorPlan>(planId, body).then((plan) => ({ updatedAt: planVersion(plan) }));
  },
submitFloorPlanDraft: (eventId: string, draftId: string) => eventOpsClient.floorplans.submitDraft(eventId, draftId),
};
