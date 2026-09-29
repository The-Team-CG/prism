import {
  PRISM_LEGACY_SESSION_STORAGE_KEYS,
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  type PrismClientActionCenter,
  type PrismClientWorkspace,
  type PrismFloorPlanDraft,
  type CreatePrismInquiryInput,
  type CreateFloorPlanPreferenceInput,
  type CreateFloorPlanRevisionCommentInput,
  type PrismUser,
  type PrismFloorPlanSnapshot,
} from "@prism/types";
import {
  clientApi,
  clientApiRequest,
  isClientLocalDemoMode,
} from "@/lib/prism-api";
import { prismApi as samplePrismApi } from "@/compatibility/sample/prism-api";
import type { Project } from "@/features/floorplan/editor";
import type { ClientSession } from "../model/client-dashboard-types";

export type FloorPlanPreferenceInput = CreateFloorPlanPreferenceInput;

type ApiFloorPlanSnapshot = Omit<PrismFloorPlanSnapshot, "objects" | "guests" | "suppliers"> &
  Pick<Project, "objects" | "guests" | "suppliers">;

function toProject(plan: ApiFloorPlanSnapshot): Project {
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

export const clientDashboardRepository = {
  readSession(): ClientSession | null {
    return readPrismSession<ClientSession>(PRISM_SESSION_STORAGE_KEYS.client, {
      legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
    });
  },

  clearSession(): void {
    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client, {
      legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
    });
  },

  loadWorkspace(session: Pick<PrismUser, "name" | "email">): Promise<PrismClientWorkspace> {
    if (isClientLocalDemoMode) return samplePrismApi.clientState(session);
    return clientApi.clientWorkspace.detail();
  },

  loadActionCenter(session: Pick<PrismUser, "name" | "email">): Promise<PrismClientActionCenter> {
    if (isClientLocalDemoMode) return samplePrismApi.clientActionCenter(session);
    return clientApi.clientWorkspace.actionCenter();
  },

  createInquiry(input: CreatePrismInquiryInput) {
    if (isClientLocalDemoMode) return samplePrismApi.createInquiry(input);
    return clientApi.inquiries.create(input);
  },

  createFloorPlanPreference(
    eventId: string,
    input: FloorPlanPreferenceInput,
    session?: Pick<PrismUser, "name" | "email">,
  ): Promise<PrismFloorPlanDraft> {
    if (isClientLocalDemoMode) return samplePrismApi.createFloorPlanPreference(eventId, input, session);
    return clientApiRequest<PrismFloorPlanDraft>(
      `/events/${eventId}/floorplan-preferences`,
      { method: "POST", body: input },
    );
  },

  async loadFloorPlanSnapshot(
    eventId: string,
    draftId: string,
    type: "submitted" | "approved" = "approved",
    session?: Pick<PrismUser, "name" | "email">,
  ): Promise<Project> {
    if (isClientLocalDemoMode) return samplePrismApi.loadFloorPlanSnapshot(eventId, draftId, type, session);
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(
      `/events/${eventId}/floorplans/${draftId}/snapshot?type=${type}`,
    );
    return toProject(plan);
  },

  submitFloorPlanRevisionComment(
    eventId: string,
    draftId: string,
    input: CreateFloorPlanRevisionCommentInput,
    session?: Pick<PrismUser, "name" | "email">,
  ): Promise<PrismFloorPlanDraft> {
    if (isClientLocalDemoMode) return samplePrismApi.reviewFloorPlanDraft(eventId, draftId, input, session);
    return clientApi.events.reviewFloorPlanDraft(eventId, draftId, input);
  },

  async loadPlan(planId: string, session?: Pick<PrismUser, "name" | "email">): Promise<Project> {
    if (isClientLocalDemoMode) return samplePrismApi.loadPlan(planId, session);
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(`/plans/${planId}`);
    return toProject(plan);
  },

  async savePlan(project: Project, session?: Pick<PrismUser, "name" | "email">): Promise<Project> {
    if (isClientLocalDemoMode) return samplePrismApi.savePlan(project, session);
    const plan = await clientApiRequest<ApiFloorPlanSnapshot>(
      `/plans/${project.id}`,
      {
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
      },
    );
    return toProject(plan);
  },
};
