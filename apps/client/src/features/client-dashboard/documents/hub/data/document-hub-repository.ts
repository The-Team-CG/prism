import type { PrismStoredObject } from '@prism/types';
import { createEventOpsClient } from '@prism/api-client';

const client = createEventOpsClient();
export const documentHubRepository = {
  list: (eventId: string) => client.events.documents(eventId),
};
export type DocumentHubRepository = typeof documentHubRepository;
export type { PrismStoredObject };
