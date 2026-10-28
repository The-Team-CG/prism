import { clientStoredFilesRepository } from "../data/client-stored-files-repository";

export function loadClientStoredFiles(eventId: string) {
  return Promise.all([clientStoredFilesRepository.list(eventId), clientStoredFilesRepository.requirements(eventId)]);
}

export async function uploadClientStoredFile(file: File, eventId: string, attemptId: string, requirementKey?: string) {
  const object = await clientStoredFilesRepository.upload(file, eventId, "client_document", attemptId);
  if (requirementKey) await clientStoredFilesRepository.bindRequirementUpload(eventId, requirementKey, object.id);
  return object;
}

export function downloadClientStoredFile(objectId: string) {
  return clientStoredFilesRepository.download(objectId);
}
