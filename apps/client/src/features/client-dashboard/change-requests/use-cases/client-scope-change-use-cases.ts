import { parseContract, submitScopeChangeRequestSchema, type SubmitScopeChangeRequestInput } from "@prism/types";
import { clientChangeRequestRepository } from "../data/client-change-request-repository";

/** The shared Zod contract is the boundary check; the server repeats it and decides who may submit. */
export function submitScopeChangeUseCase(eventId: string, draft: SubmitScopeChangeRequestInput) {
  const input = parseContract(submitScopeChangeRequestSchema, draft, "Scope change request");
  return clientChangeRequestRepository.submitScopeChange(eventId, input);
}

export function withdrawScopeChangeUseCase(eventId: string, requestId: string) {
  return clientChangeRequestRepository.withdrawScopeChange(eventId, requestId);
}
