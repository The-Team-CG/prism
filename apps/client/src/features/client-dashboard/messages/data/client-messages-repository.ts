import type { PrismCommunicationThread, PrismCursorPage } from '@prism/types';
import { clientApi } from '@/lib/prism-api';

export const clientMessagesRepository = {
  list(eventId: string) { return clientApi.communication.listThreads(eventId); },
  send(threadId: string, body: string, idempotencyKey: string) { return clientApi.communication.sendMessage(threadId, { body, idempotencyKey }); },
  listOlder(threadId: string, cursor: string, limit = 100): Promise<PrismCursorPage<PrismCommunicationThread['messages'][number]>> { return clientApi.communication.listMessages(threadId, { cursor, limit }); },
  markRead(threadId: string) { return clientApi.communication.markThreadRead(threadId); },
};
