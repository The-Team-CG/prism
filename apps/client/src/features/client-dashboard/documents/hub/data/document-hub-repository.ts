import type { PrismStoredObject } from '@prism/types';
import { createEventOpsClient } from '@prism/api-client';

const client = createEventOpsClient({ baseUrl: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api` });
export const documentHubRepository = {
  list: (eventId: string) => client.events.documents(eventId),
};
export type DocumentHubRepository = typeof documentHubRepository;
export type { PrismStoredObject };
