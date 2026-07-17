import {
  PRISM_LEGACY_SESSION_STORAGE_KEYS,
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  type PrismClientActionCenter,
  type PrismClientWorkspace,
  type PrismFloorPlanDraft,
  type CreatePrismInquiryInput,
  type PrismFloorPlanPreference,
  type PrismUser,
} from "@prism/types";
import { prismApi } from "@/lib/prism-api";
import type { Project } from "@/features/floorplan/editor/types";
import type { ClientSession } from "../model/client-dashboard-types";

export type FloorPlanPreferenceInput = {
  name: string;
  venue?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  objects?: Project["objects"];
} & PrismFloorPlanPreference;

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
    return prismApi.clientState(session);
  },

  loadActionCenter(session: Pick<PrismUser, "name" | "email">): Promise<PrismClientActionCenter> {
    return prismApi.clientActionCenter(session);
  },

  createInquiry(input: CreatePrismInquiryInput) {
    return prismApi.createInquiry(input);
  },

  createFloorPlanPreference(
    eventId: string,
    input: FloorPlanPreferenceInput,
    session?: Pick<PrismUser, "name" | "email">,
  ): Promise<PrismFloorPlanDraft> {
    return prismApi.createFloorPlanPreference(eventId, input, session);
  },

  loadFloorPlanSnapshot(
    eventId: string,
    draftId: string,
    type: "submitted" | "approved" = "approved",
    session?: Pick<PrismUser, "name" | "email">,
  ): Promise<Project> {
    return prismApi.loadFloorPlanSnapshot(eventId, draftId, type, session);
  },

  loadPlan(planId: string, session?: Pick<PrismUser, "name" | "email">): Promise<Project> {
    return prismApi.loadPlan(planId, session);
  },

  savePlan(project: Project, session?: Pick<PrismUser, "name" | "email">): Promise<Project> {
    return prismApi.savePlan(project, session);
  },
};
