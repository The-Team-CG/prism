import type { PrismAuthenticatedSession, PrismCommunicationThread, PrismCursorPage } from '@prism/types';
import { prismApi } from '@/lib/prism-api';

export const supplierMessagesRepository = {
  list(eventId: string, session: PrismAuthenticatedSession) { return prismApi.communicationThreads(eventId, session); },
  send(threadId: string, body: string, key: string, session: PrismAuthenticatedSession) { return prismApi.sendCommunicationMessage(threadId, body, key, session); },
  listOlder(threadId: string, cursor: string, session: PrismAuthenticatedSession): Promise<PrismCursorPage<PrismCommunicationThread['messages'][number]>> { return prismApi.communicationMessages(threadId, cursor, 100, session); },
  markRead(threadId: string, session: PrismAuthenticatedSession) { return prismApi.markCommunicationThreadRead(threadId, session); },
};
