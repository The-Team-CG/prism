import { parseContract, setStorageObjectExpirySchema } from "@prism/types";
import { pmcmDocumentRepository } from "../data/pmcm-document-repository";

/** Sets or clears the last day a stored document is valid, checked against the shared contract first. */
export function setFileExpiry(objectId: string, expiresAt: string | null) {
  const input = parseContract(setStorageObjectExpirySchema, { expiresAt }, "Valid until");
  return pmcmDocumentRepository.setExpiry(objectId, input.expiresAt);
}
