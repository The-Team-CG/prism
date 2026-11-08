import { parseContract, submitOwnPrivacyRequestSchema, type PrismOwnPrivacyRequest } from "@prism/types";
import { supplierPrivacyRequestRepository } from "../data/supplier-privacy-repository";

/** Validates the form draft with the shared contract before it leaves the portal. */
export function submitSupplierPrivacyRequest(draft: unknown): Promise<PrismOwnPrivacyRequest> {
  const input = parseContract(submitOwnPrivacyRequestSchema, draft, "Privacy request");
  return supplierPrivacyRequestRepository.submit(input);
}
