import { createEventOpsClient } from '@prism/api-client';
const client = createEventOpsClient();
export const supplierDocumentRepository = { list: (eventId: string) => client.events.documents(eventId) };
