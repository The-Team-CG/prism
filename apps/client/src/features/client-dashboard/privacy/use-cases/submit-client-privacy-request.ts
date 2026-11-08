import { parseContract, submitOwnPrivacyRequestSchema, type PrismOwnPrivacyRequest } from "@prism/types";
import { clientPrivacyRequestRepository } from "../data/client-privacy-repository";

/** Validates the form draft with the shared contract before it leaves the portal. */
export function submitClientPrivacyRequest(draft: unknown): Promise<PrismOwnPrivacyRequest> {
  const input = parseContract(submitOwnPrivacyRequestSchema, draft, "Privacy request");
  return clientPrivacyRequestRepository.submit(input);
}
