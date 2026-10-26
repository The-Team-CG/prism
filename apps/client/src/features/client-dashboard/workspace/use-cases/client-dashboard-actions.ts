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
  submitBriefingSchema,
  type SubmitBriefingInput,
} from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import type { PrismFloorPlanDraft } from "@prism/types";
import { buildReopenedFloorPlanPreferencePayload } from "../model/client-floorplan-preference-rules";

export function readClientSession() {
  return clientDashboardRepository.readSession();
}

export async function signOutClientSession(): Promise<void> {
  try {
    await clientDashboardRepository.logout();
  } catch {
    // Signing out locally is the user's intent; the server token dies at expiry.
  } finally {
    clientDashboardRepository.clearSession();
  }
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

export function submitClientBriefing(eventId: string, input: SubmitBriefingInput) {
  const payload = parseContract(submitBriefingSchema, input, "Event briefing");
  return clientDashboardRepository.submitBriefing(eventId, payload);
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

export function submitFloorPlanEditorProject(eventId: string, draft: PrismFloorPlanDraft, project: Project) {
  if (draft.sourceType === "client_preference" && draft.status === "revision_requested") {
    const input = buildReopenedFloorPlanPreferencePayload(draft, project);
    return clientDashboardRepository.createFloorPlanPreference(eventId, input);
  }
  return clientDashboardRepository.savePlan(project);
}
