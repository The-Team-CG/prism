import { createEventOpsClient } from '@prism/api-client';
const client = createEventOpsClient({ baseUrl: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api` });
export const pmcmDocumentRepository = { list: (eventId: string) => client.events.documents(eventId) };
