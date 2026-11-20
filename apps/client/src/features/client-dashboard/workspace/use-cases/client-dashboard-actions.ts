import {
  clientDashboardRepository,
  type FloorPlanPreferenceInput,
} from "../data/client-dashboard-repository";
import {
  parseContract,
  submitClientOcularVisitSchema,
  type CreatePrismInquiryInput,
  type SubmitClientOcularVisitInput,
  submitBriefingSchema,
  type SubmitBriefingInput,
} from "@prism/types";
import type { FloorplanSceneDocument, PrismFloorPlanDraft } from "@prism/types";
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

/** Sends the client's scene to PMCM as their revised preference; only a preference PMCM has reopened can take one. */
export function submitFloorPlanEditorScene(eventId: string, draft: PrismFloorPlanDraft, scene: FloorplanSceneDocument) {
  return clientDashboardRepository.createFloorPlanPreference(eventId, buildReopenedFloorPlanPreferencePayload(draft, scene));
}
