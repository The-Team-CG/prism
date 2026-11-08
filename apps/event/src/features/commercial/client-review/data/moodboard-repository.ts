import { stylingMoodboardImages, stylingMoodboardTarget, type PrismStoredObject } from "@prism/types";
import { getStorageObjectDownload, uploadStorageObject } from "@prism/api-client";
import { eventApiRequest, storedEventAccessToken } from "@/lib/prism-api";

/** FR-09: PMCM attaches moodboard images to a styling option; the client sees them with the option. */
export const moodboardRepository = {
  async list(eventId: string, itemId: string): Promise<PrismStoredObject[]> {
    return stylingMoodboardImages(await eventApiRequest<PrismStoredObject[]>(`/api/storage/objects/events/${encodeURIComponent(eventId)}`), itemId);
  },
  upload(file: File, eventId: string, itemId: string) {
    return uploadStorageObject(file, {
      eventId, ownerRecordType: "client_review_item", ownerRecordId: itemId,
      logicalTarget: stylingMoodboardTarget(itemId, crypto.randomUUID()), usage: "event_deliverable",
    }, { authToken: storedEventAccessToken() });
  },
  download: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() }),
};
