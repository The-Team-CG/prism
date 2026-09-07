import type { PrismCommunicationThread, PrismCursorPage } from '@prism/types';
import { prismApi } from '@/lib/prism-api';

export const clientMessagesRepository = {
  list(eventId: string) { return prismApi.communicationThreads(eventId); },
  send(threadId: string, body: string, idempotencyKey: string) { return prismApi.sendCommunicationMessage(threadId, body, idempotencyKey); },
  listOlder(threadId: string, cursor: string, limit = 100): Promise<PrismCursorPage<PrismCommunicationThread['messages'][number]>> { return prismApi.communicationMessages(threadId, cursor, limit); },
  markRead(threadId: string) { return prismApi.markCommunicationThreadRead(threadId); },
};
