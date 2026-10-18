import type { PrismStoredObject, StorageUsage } from "@prism/types";
import { getStorageObjectDownload, uploadStorageObject } from "@prism/api-client";
import { clientApiRequest, storedClientAccessToken } from "@/lib/prism-api";

export const clientStoredFilesRepository = {
  list(eventId: string): Promise<PrismStoredObject[]> {
    return clientApiRequest(`/storage/objects/events/${encodeURIComponent(eventId)}`);
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

  download(objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: storedClientAccessToken() });
  },
};
