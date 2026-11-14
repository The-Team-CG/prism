import type { PrismFileRequirementItem, PrismFileRequirementsMatrix, PrismStoredObject, StorageUsage } from "@prism/types";
import { copyStorageObject, getStorageObjectDownload, searchClientStoredFiles, setStorageObjectExpiry, uploadStorageObject } from "@prism/api-client";
import { clientApi, storedClientAccessToken } from "@/lib/prism-api";

export const clientStoredFilesRepository = {
  list(eventId: string): Promise<PrismStoredObject[]> {
    return clientApi.events.storageObjects(eventId);
  },

  requirements(eventId: string): Promise<PrismFileRequirementsMatrix> {
    return clientApi.events.fileRequirements(eventId);
  },

  upload(file: File, eventId: string, usage: Extract<StorageUsage, "client_document">, attemptId: string) {
    return uploadStorageObject(file, {
      eventId,
      ownerRecordType: "event",
      ownerRecordId: eventId,
      logicalTarget: `client-upload:${eventId}:${attemptId}`,
      usage,
    }, { authToken: storedClientAccessToken() });
  },

  bindRequirementUpload(eventId: string, key: string, objectId: string): Promise<PrismFileRequirementItem> {
    return clientApi.events.bindFileRequirementUpload(eventId, key, { objectId });
  },

  /** A server-side copy of a file the client can read, stored for this event under its own client-upload target. */
  copy(sourceObjectId: string, eventId: string, attemptId: string): Promise<PrismStoredObject> {
    return copyStorageObject(sourceObjectId, { eventId, logicalTarget: `client-upload:${eventId}:${attemptId}` }, { authToken: storedClientAccessToken() });
  },

  /** The client's stored files across all of their events, matching a file name. */
  search(query: string, signal?: AbortSignal): Promise<PrismStoredObject[]> {
    return searchClientStoredFiles(query, { authToken: storedClientAccessToken(), signal });
  },

  /** Sets or clears the last day one of the client's own files is valid. */
  setExpiry(objectId: string, expiresAt: string | null): Promise<PrismStoredObject> {
    return setStorageObjectExpiry(objectId, { expiresAt }, { authToken: storedClientAccessToken() });
  },

  download(objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: storedClientAccessToken() });
  },
};
