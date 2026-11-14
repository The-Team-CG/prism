import { eventFileLogicalTarget, type EventFileCategory, type PrismStoredObject } from '@prism/types';
import { getStorageObjectDownload, setStorageObjectExpiry, uploadStorageObject } from '@prism/api-client';
import { eventApi, storedEventAccessToken } from '@/lib/prism-api';

export const pmcmDocumentRepository = {
  list(eventId: string): Promise<PrismStoredObject[]> {
    return eventApi.events.storageObjects(eventId);
  },

  upload(file: File, eventId: string, category: EventFileCategory, attemptId: string) {
    return uploadStorageObject(file, {
      eventId,
      ownerRecordType: 'event',
      ownerRecordId: eventId,
      logicalTarget: eventFileLogicalTarget(eventId, category, attemptId),
      usage: 'event_deliverable',
    }, { authToken: storedEventAccessToken() });
  },

  setExpiry(objectId: string, expiresAt: string | null): Promise<PrismStoredObject> {
    return setStorageObjectExpiry(objectId, { expiresAt }, { authToken: storedEventAccessToken() });
  },

  download(objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() });
  },
};
