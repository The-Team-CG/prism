import type { AcknowledgeClientDeliverableInput, SubmitClientCloseoutResponseInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientCloseoutRepository = {
  get(eventId: string) {
    return clientApi.clientPortal.closeout(eventId);
  },
  acknowledgeWrapUp(eventId: string, input: AcknowledgeClientDeliverableInput) {
    return clientApi.clientPortal.acknowledgeWrapUp(eventId, input);
  },
  acknowledgeDeliverable(eventId: string, documentId: string, input: AcknowledgeClientDeliverableInput) {
    return clientApi.clientPortal.acknowledgeDeliverable(eventId, documentId, input);
  },
  submitResponse(eventId: string, input: SubmitClientCloseoutResponseInput) {
    return clientApi.clientPortal.submitCloseoutResponse(eventId, input);
  },
  revokeTestimonialConsent(eventId: string) {
    return clientApi.clientPortal.revokeTestimonialConsent(eventId);
  },
};
