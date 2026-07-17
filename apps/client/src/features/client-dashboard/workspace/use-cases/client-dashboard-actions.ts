import {
  clientDashboardRepository,
  type FloorPlanPreferenceInput,
} from "../data/client-dashboard-repository";
import type { CreatePrismInquiryInput, PrismUser } from "@prism/types";
import type { Project } from "@/features/floorplan/editor/types";

export function readClientSession() {
  return clientDashboardRepository.readSession();
}

export function signOutClientSession() {
  clientDashboardRepository.clearSession();
}

export function loadClientWorkspace(session: Pick<PrismUser, "name" | "email">) {
  return clientDashboardRepository.loadWorkspace(session);
}

export function loadClientActionCenter(session: Pick<PrismUser, "name" | "email">) {
  return clientDashboardRepository.loadActionCenter(session);
}

export function submitClientInquiry(input: CreatePrismInquiryInput) {
  return clientDashboardRepository.createInquiry(input);
}

export function submitFloorPlanPreference(
  eventId: string,
  input: FloorPlanPreferenceInput,
  session?: Pick<PrismUser, "name" | "email">,
) {
  return clientDashboardRepository.createFloorPlanPreference(eventId, input, session);
}

export function loadOfficialFloorPlan(
  eventId: string,
  draftId: string,
  type: "submitted" | "approved",
  session?: Pick<PrismUser, "name" | "email">,
) {
  return clientDashboardRepository.loadFloorPlanSnapshot(eventId, draftId, type, session);
}

export function loadFloorPlanProject(planId: string, session?: Pick<PrismUser, "name" | "email">) {
  return clientDashboardRepository.loadPlan(planId, session);
}

export function saveFloorPlanProject(project: Project, session?: Pick<PrismUser, "name" | "email">) {
  return clientDashboardRepository.savePlan(project, session);
}
