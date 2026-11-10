import type { PrismFileRequirementItem, PrismFileRequirementsMatrix, PrismStoredObject, StorageUsage } from "@prism/types";
import { getStorageObjectDownload, uploadStorageObject } from "@prism/api-client";
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

  download(objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: storedClientAccessToken() });
  },
};
