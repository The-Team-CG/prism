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
import { withBase, actorPath } from "./shared";

export function createClientPortalClient(options: EventOpsClientOptions): Pick<EventOpsClient, "clientPortal"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  const token = (value: string) => encodeURIComponent(value);
  return {
    clientPortal: {
      closeout: (eventId, actor = {}) =>
        prismRequest<PrismClientCloseoutWorkspace>(actorPath(event(eventId, "/client-closeout"), actor), withBase(options)),
      acknowledgeWrapUp: (eventId, input, actor = {}) =>
        prismRequest<unknown>(actorPath(event(eventId, "/client-closeout/acknowledgement"), actor), withBase(options, { method: "POST", body: input })),
      acknowledgeDeliverable: (eventId, documentId, input, actor = {}) =>
        prismRequest<unknown>(actorPath(event(eventId, `/client-closeout/deliverables/${documentId}/acknowledgement`), actor), withBase(options, { method: "POST", body: input })),
      submitCloseoutResponse: (eventId, input, actor = {}) =>
        prismRequest<PrismClientCloseoutResponse>(actorPath(event(eventId, "/client-closeout/response"), actor), withBase(options, { method: "POST", body: input })),
      revokeTestimonialConsent: (eventId, actor = {}) =>
        prismRequest<PrismClientCloseoutResponse>(actorPath(event(eventId, "/client-closeout/testimonial-consent/revoke"), actor), withBase(options, { method: "POST" })),
      floorplanReview: (eventId, draftId, actor = {}) =>
        prismRequest<PrismClientFloorPlanReview>(actorPath(event(eventId, `/floorplans/${draftId}/client-review`), actor), withBase(options)),
      decideFloorplan: (eventId, draftId, input, actor = {}) =>
        prismRequest<unknown>(actorPath(event(eventId, `/floorplans/${draftId}/client-review`), actor), withBase(options, { method: "POST", body: input })),
      annotateFloorplan: (eventId, draftId, input, actor = {}) =>
        prismRequest<unknown>(actorPath(event(eventId, `/floorplans/${draftId}/client-annotations`), actor), withBase(options, { method: "POST", body: input })),
      submitOcularVisit: (eventId, input, actor = {}) =>
        prismRequest<PrismClientOcularVisit>(actorPath(event(eventId, "/ocular-visit"), actor), withBase(options, { method: "POST", body: input })),
      submitBriefing: (eventId, input, actor = {}) =>
        prismRequest<PrismBriefing>(actorPath(event(eventId, "/briefing"), actor), withBase(options, { method: "POST", body: input })),
      createFloorplanPreference: (eventId, input, actor = {}) =>
        prismRequest<PrismFloorPlanDraft>(actorPath(event(eventId, "/floorplan-preferences"), actor), withBase(options, { method: "POST", body: input })),
      floorplanSnapshot: <TSnapshot = unknown>(eventId: string, draftId: string, type: string, actor = {}) =>
        prismRequest<TSnapshot>(actorPath(`/events/${encodeURIComponent(eventId)}/floorplans/${encodeURIComponent(draftId)}/snapshot?type=${type}`, actor), withBase(options)),
      sharedFloorplans: (actor = {}) =>
        prismRequest<PrismClientSharedFloorplanEntry[]>(actorPath("/client/shared-floorplans", actor), withBase(options)),
      conformeExecutions: (actor = {}) =>
        prismRequest<{ executions: PrismConformeExecution[] }>(actorPath("/client/conforme-execution", actor), withBase(options)),
      signConforme: (input, actor = {}) =>
        prismRequest<PrismConformeExecution>(actorPath("/client/conforme-execution/sign", actor), withBase(options, { method: "POST", body: input })),
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
