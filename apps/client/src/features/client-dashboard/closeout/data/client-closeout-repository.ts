import type {
  AcknowledgeClientDeliverableInput,
  PrismClientCloseoutWorkspace,
  SubmitClientCloseoutResponseInput,
  PrismClientCloseoutResponse,
} from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export const clientCloseoutRepository = {
  get(eventId: string) {
    return clientApiRequest<PrismClientCloseoutWorkspace>(`/events/${eventId}/client-closeout`);
  },
  acknowledgeWrapUp(eventId: string, input: AcknowledgeClientDeliverableInput) {
    return clientApiRequest(`/events/${eventId}/client-closeout/acknowledgement`, { method: "POST", body: input });
  },
  acknowledgeDeliverable(eventId: string, documentId: string, input: AcknowledgeClientDeliverableInput) {
    return clientApiRequest(`/events/${eventId}/client-closeout/deliverables/${documentId}/acknowledgement`, { method: "POST", body: input });
  },
  submitResponse(eventId: string, input: SubmitClientCloseoutResponseInput) {
    return clientApiRequest<PrismClientCloseoutResponse>(`/events/${eventId}/client-closeout/response`, { method: "POST", body: input });
  },
  revokeTestimonialConsent(eventId: string) {
    return clientApiRequest<PrismClientCloseoutResponse>(`/events/${eventId}/client-closeout/testimonial-consent/revoke`, { method: "POST" });
  },
};
