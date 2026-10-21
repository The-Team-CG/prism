import type { PrismStoredObject } from '@prism/types';
import { getStorageObjectDownload, uploadStorageObject } from '@prism/api-client';
import { eventApiRequest, storedEventAccessToken } from '@/lib/prism-api';

export const pmcmDocumentRepository = {
  list(eventId: string): Promise<PrismStoredObject[]> {
    return eventApiRequest(`/api/storage/objects/events/${encodeURIComponent(eventId)}`);
  },

  upload(file: File, eventId: string, attemptId: string) {
    return uploadStorageObject(file, {
      eventId,
      ownerRecordType: 'event',
      ownerRecordId: eventId,
      logicalTarget: `event-deliverable:${eventId}:${attemptId}`,
      usage: 'event_deliverable',
    }, { authToken: storedEventAccessToken() });
  },

  download(objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() });
  },
};
