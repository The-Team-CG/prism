import type { Project } from "@/features/floorplan/editor";
import { eventApi as eventOpsClient } from "@/lib/prism-api";
import type { PrismEventPrivacy, CreateFloorPlanDraftInput } from "@prism/types";

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
  updatedAt?: string;
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
submitFloorPlanDraft: (eventId: string, draftId: string) => eventOpsClient.floorplans.submitDraft(eventId, draftId),
};
