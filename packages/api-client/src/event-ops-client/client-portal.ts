import type {
  PrismBriefing,
  PrismClientCloseoutResponse,
  PrismClientCloseoutWorkspace,
  PrismClientFloorPlanReview,
  PrismClientOcularVisit,
  PrismClientSharedFloorplanEntry,
  PrismConformeExecution,
  PrismFloorPlanDraft,
  PrismInquiryDraft,
  PrismPublicInquiryEdit,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createClientPortalClient(options: EventOpsClientOptions): Pick<EventOpsClient, "clientPortal"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  const token = (value: string) => encodeURIComponent(value);
  return {
    clientPortal: {
      closeout: (eventId) =>
        prismRequest<PrismClientCloseoutWorkspace>(event(eventId, "/client-closeout"), withBase(options)),
      acknowledgeWrapUp: (eventId, input) =>
        prismRequest<unknown>(event(eventId, "/client-closeout/acknowledgement"), withBase(options, { method: "POST", body: input })),
      acknowledgeDeliverable: (eventId, documentId, input) =>
        prismRequest<unknown>(event(eventId, `/client-closeout/deliverables/${documentId}/acknowledgement`), withBase(options, { method: "POST", body: input })),
      submitCloseoutResponse: (eventId, input) =>
        prismRequest<PrismClientCloseoutResponse>(event(eventId, "/client-closeout/response"), withBase(options, { method: "POST", body: input })),
      revokeTestimonialConsent: (eventId) =>
        prismRequest<PrismClientCloseoutResponse>(event(eventId, "/client-closeout/testimonial-consent/revoke"), withBase(options, { method: "POST" })),
      floorplanReview: (eventId, draftId) =>
        prismRequest<PrismClientFloorPlanReview>(event(eventId, `/floorplans/${draftId}/client-review`), withBase(options)),
      decideFloorplan: (eventId, draftId, input) =>
        prismRequest<unknown>(event(eventId, `/floorplans/${draftId}/client-review`), withBase(options, { method: "POST", body: input })),
      annotateFloorplan: (eventId, draftId, input) =>
        prismRequest<unknown>(event(eventId, `/floorplans/${draftId}/client-annotations`), withBase(options, { method: "POST", body: input })),
      submitOcularVisit: (eventId, input) =>
        prismRequest<PrismClientOcularVisit>(event(eventId, "/ocular-visit"), withBase(options, { method: "POST", body: input })),
      submitBriefing: (eventId, input) =>
        prismRequest<PrismBriefing>(event(eventId, "/briefing"), withBase(options, { method: "POST", body: input })),
      createFloorplanPreference: (eventId, input) =>
        prismRequest<PrismFloorPlanDraft>(event(eventId, "/floorplan-preferences"), withBase(options, { method: "POST", body: input })),
      floorplanSnapshot: <TSnapshot = unknown>(eventId: string, draftId: string, type: string) =>
        prismRequest<TSnapshot>(`/events/${encodeURIComponent(eventId)}/floorplans/${encodeURIComponent(draftId)}/snapshot?type=${type}`, withBase(options)),
      sharedFloorplans: () =>
        prismRequest<PrismClientSharedFloorplanEntry[]>("/client/shared-floorplans", withBase(options)),
      conformeExecutions: () =>
        prismRequest<{ executions: PrismConformeExecution[] }>("/client/conforme-execution", withBase(options)),
      signConforme: (input) =>
        prismRequest<PrismConformeExecution>("/client/conforme-execution/sign", withBase(options, { method: "POST", body: input })),
      saveInquiryDraft: (draftToken, input) =>
        prismRequest<PrismInquiryDraft>(`/public-inquiries/drafts/${token(draftToken)}`, withBase(options, { method: "PUT", body: input })),
      inquiryDraft: (draftToken) =>
        prismRequest<PrismInquiryDraft>(`/public-inquiries/drafts/${token(draftToken)}`, withBase(options)),
      discardInquiryDraft: (draftToken) =>
        prismRequest<void>(`/public-inquiries/drafts/${token(draftToken)}`, withBase(options, { method: "DELETE" })),
      inquiryEdit: (editToken) =>
        prismRequest<PrismPublicInquiryEdit>(`/public-inquiries/edit/${token(editToken)}`, withBase(options)),
      saveInquiryEdit: (editToken, input) =>
        prismRequest<PrismPublicInquiryEdit>(`/public-inquiries/edit/${token(editToken)}`, withBase(options, { method: "PATCH", body: input })),
    },
  };
}
