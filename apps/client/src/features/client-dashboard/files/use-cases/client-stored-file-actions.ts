import { parseContract, setStorageObjectExpirySchema } from "@prism/types";
import { clientStoredFilesRepository } from "../data/client-stored-files-repository";

export function loadClientStoredFiles(eventId: string) {
  return Promise.all([clientStoredFilesRepository.list(eventId), clientStoredFilesRepository.requirements(eventId)]);
}

export async function uploadClientStoredFile(file: File, eventId: string, attemptId: string, requirementKey?: string) {
  const object = await clientStoredFilesRepository.upload(file, eventId, "client_document", attemptId);
  if (requirementKey) await clientStoredFilesRepository.bindRequirementUpload(eventId, requirementKey, object.id);
  return object;
}

/** Dates one of the client's own files, checked against the shared contract first. */
export function setClientFileExpiry(objectId: string, expiresAt: string | null) {
  const input = parseContract(setStorageObjectExpirySchema, { expiresAt }, "Valid until");
  return clientStoredFilesRepository.setExpiry(objectId, input.expiresAt);
}

export function downloadClientStoredFile(objectId: string) {
  return clientStoredFilesRepository.download(objectId);
}
