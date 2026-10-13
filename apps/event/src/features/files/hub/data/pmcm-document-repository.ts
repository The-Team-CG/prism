import { createEventOpsClient } from '@prism/api-client';
const client = createEventOpsClient();
export const pmcmDocumentRepository = { list: (eventId: string) => client.events.documents(eventId) };
