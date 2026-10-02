import {
  clientDashboardRepository,
  type FloorPlanPreferenceInput,
} from "../data/client-dashboard-repository";
import {
  parseContract,
  submitClientOcularVisitSchema,
  type CreateFloorPlanRevisionCommentInput,
  type CreatePrismInquiryInput,
  type SubmitClientOcularVisitInput,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";

export function readClientSession() {
  return clientDashboardRepository.readSession();
}

export function signOutClientSession() {
  clientDashboardRepository.clearSession();
}

export function loadClientWorkspace() {
  return clientDashboardRepository.loadWorkspace();
}

export function loadClientActionCenter() {
  return clientDashboardRepository.loadActionCenter();
}

export function submitClientOcularVisit(eventId: string, input: SubmitClientOcularVisitInput) {
  const payload = parseContract(submitClientOcularVisitSchema, input, "Ocular visit request");
  return clientDashboardRepository.submitOcularVisit(eventId, payload);
}

export function submitClientInquiry(input: CreatePrismInquiryInput) {
  return clientDashboardRepository.createInquiry(input);
}

export function submitFloorPlanPreference(
  eventId: string,
  input: FloorPlanPreferenceInput,
) {
  return clientDashboardRepository.createFloorPlanPreference(eventId, input);
}

export function loadOfficialFloorPlan(
  eventId: string,
  draftId: string,
  type: "submitted" | "approved",
) {
  return clientDashboardRepository.loadFloorPlanSnapshot(eventId, draftId, type);
}

export function loadFloorPlanProject(planId: string) {
  return clientDashboardRepository.loadPlan(planId);
}

export function submitFloorPlanRevisionComment(
  eventId: string,
  draftId: string,
  input: CreateFloorPlanRevisionCommentInput,
) {
  return clientDashboardRepository.submitFloorPlanRevisionComment(eventId, draftId, input);
}

export function saveFloorPlanProject(project: Project) {
  return clientDashboardRepository.savePlan(project);
}
