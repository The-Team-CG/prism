import { stylingMoodboardImages, type PrismStoredObject } from "@prism/types";
import { getStorageObjectDownload } from "@prism/api-client";
import { clientApi, storedClientAccessToken } from "@/lib/prism-api";

/** FR-09 / FR-30: the moodboard images PMCM attached to a styling option. */
export const moodboardRepository = {
  async list(eventId: string, itemId: string): Promise<PrismStoredObject[]> {
    return stylingMoodboardImages(await clientApi.events.storageObjects(eventId), itemId);
  },
  download: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedClientAccessToken() }),
};
