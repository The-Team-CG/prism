import {
  acknowledgeClientDeliverableSchema,
  parseContract,
  submitClientCloseoutResponseSchema,
  type SubmitClientCloseoutResponseInput,
} from "@prism/types";
import { clientCloseoutRepository } from "../data/client-closeout-repository";

export function loadClientCloseout(eventId: string) {
  return clientCloseoutRepository.get(eventId);
}

export function acknowledgeClientCloseout(eventId: string, note: string) {
  const input = parseContract(acknowledgeClientDeliverableSchema, { note }, "Closeout acknowledgement");
  return clientCloseoutRepository.acknowledgeWrapUp(eventId, input);
}

export function acknowledgeClientDeliverable(eventId: string, documentId: string, note: string) {
  const input = parseContract(acknowledgeClientDeliverableSchema, { note }, "Deliverable acknowledgement");
  return clientCloseoutRepository.acknowledgeDeliverable(eventId, documentId, input);
}

export function submitClientCloseoutResponse(eventId: string, input: SubmitClientCloseoutResponseInput) {
  const payload = parseContract(submitClientCloseoutResponseSchema, input, "Event feedback");
  return clientCloseoutRepository.submitResponse(eventId, payload);
}

export function revokeClientTestimonialConsent(eventId: string) {
  return clientCloseoutRepository.revokeTestimonialConsent(eventId);
}
