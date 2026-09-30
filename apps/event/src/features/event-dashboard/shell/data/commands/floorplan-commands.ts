import type { Project } from "@/features/floorplan/editor";
import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { CreateFloorPlanDraftInput, PrismFloorPlanDraft } from "@prism/types";

interface ApiFloorPlan {
  id: string;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
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
    objects: Array.isArray(plan.objects) ? plan.objects : [],
    guests: Array.isArray(plan.guests) ? plan.guests : [],
    suppliers: Array.isArray(plan.suppliers) ? plan.suppliers : [],
    createdAt: updatedAt,
    updatedAt,
  };
}

export const floorplanCommands = {
approveFloorPlanDraft: (eventId: string, draftId: string) =>
    request<PrismFloorPlanDraft>(`/api/events/${eventId}/floorplans/${draftId}/approve`, { method: "POST" }),
createFloorPlanDraft: (eventId: string, input: CreateFloorPlanDraftInput) =>
    request<PrismFloorPlanDraft>(`/api/events/${eventId}/floorplans`, {
      method: "POST",
      body: input,
    }),
loadPlan: (planId: string) =>
    request<ApiFloorPlan>(`/api/plans/${planId}`).then((plan) => apiPlanToProject(plan)),
savePlan: (project: Project) =>
    request<ApiFloorPlan>(`/api/plans/${project.id}`, {
      method: "PUT",
      body: {
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
      },
    }).then((plan) => apiPlanToProject(plan)),
submitFloorPlanDraft: (eventId: string, draftId: string) =>
    request<PrismFloorPlanDraft>(`/api/events/${eventId}/floorplans/${draftId}/submit`, { method: "POST" }),
};
