import type { Project } from "@/features/floorplan/editor";
import { eventApi as eventOpsClient } from "@/lib/prism-api";
import type { PrismEventPrivacy, CreateFloorPlanDraftInput, FloorplanSceneDocument, UpdatePlanInput } from "@prism/types";

interface ApiFloorPlan {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  eventPrivacy: PrismEventPrivacy;
  objects?: Project["objects"];
  guests?: Project["guests"];
  suppliers?: Project["suppliers"];
  scene?: FloorplanSceneDocument | null;
  updatedAt?: string;
}

/** A plan as the Pascal editor opens it: the legacy fields it converts from, its stored scene and its version. */
export interface PlanSceneToOpen {
  project: Project;
  scene: FloorplanSceneDocument | null;
  updatedAt: string;
}

function planVersion(plan: ApiFloorPlan): string {
  if (!plan.updatedAt) throw new Error(`Floor plan ${plan.id} came back without its version`);
  return plan.updatedAt;
}

function apiPlanToProject(plan: ApiFloorPlan): Project {
  const updatedAt = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
  return {
    id: plan.id,
    name: plan.name,
    venue: plan.venue,
    widthM: plan.width,
    heightM: plan.height,
    pax: plan.pax,
    eventPrivacy: plan.eventPrivacy,
    objects: Array.isArray(plan.objects) ? plan.objects : [],
    guests: Array.isArray(plan.guests) ? plan.guests : [],
    suppliers: Array.isArray(plan.suppliers) ? plan.suppliers : [],
    createdAt: updatedAt,
    updatedAt,
  };
}

export const floorplanCommands = {
approveFloorPlanDraft: (eventId: string, draftId: string) => eventOpsClient.floorplans.approveDraft(eventId, draftId),
reopenClientPreference: (eventId: string, draftId: string) => eventOpsClient.floorplans.reopenPreference(eventId, draftId),
createFloorPlanDraft: (eventId: string, input: CreateFloorPlanDraftInput) => eventOpsClient.floorplans.createDraft(eventId, input),
loadPlan: (planId: string) =>
    eventOpsClient.floorplans.plan<ApiFloorPlan>(planId).then((plan) => apiPlanToProject(plan)),
savePlan: (project: Project) =>
    eventOpsClient.floorplans.savePlan<ApiFloorPlan>(project.id, {
      expectedUpdatedAt: new Date(project.updatedAt).toISOString(),
      venue: project.venue,
      width: Math.max(1, Math.round(project.widthM)),
      height: Math.max(1, Math.round(project.heightM)),
      gridSize: 1,
      pax: Math.max(0, Math.round(project.pax)),
      objects: project.objects,
      guests: project.guests,
      suppliers: project.suppliers,
      seats: [],
      seatCategories: [],
    }).then((plan) => apiPlanToProject(plan)),
loadPlanScene: (planId: string): Promise<PlanSceneToOpen> =>
    eventOpsClient.floorplans.plan<ApiFloorPlan>(planId).then((plan) => ({ project: apiPlanToProject(plan), scene: plan.scene ?? null, updatedAt: planVersion(plan) })),
/** Saves a Pascal scene against the version it was loaded or last saved at; the legacy columns are left as they are. */
savePlanScene: (planId: string, scene: FloorplanSceneDocument, expectedUpdatedAt: string) => {
    const body: UpdatePlanInput = { expectedUpdatedAt, scene };
    return eventOpsClient.floorplans.savePlan<ApiFloorPlan>(planId, body).then((plan) => ({ updatedAt: planVersion(plan) }));
  },
submitFloorPlanDraft: (eventId: string, draftId: string) => eventOpsClient.floorplans.submitDraft(eventId, draftId),
};
