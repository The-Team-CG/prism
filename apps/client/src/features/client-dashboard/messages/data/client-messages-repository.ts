import type { CommunicationUnreadCountQuery } from '@prism/types';
import { clientApi } from '@/lib/prism-api';

export const clientMessagesRepository = {
  list(eventId: string) { return clientApi.communication.listThreads(eventId); },
  inbox() { return clientApi.communication.listInbox(); },
  unreadCount(query: CommunicationUnreadCountQuery) { return clientApi.communication.unreadCount(query); },
  send(threadId: string, body: string, idempotencyKey: string) { return clientApi.communication.sendMessage(threadId, { body, idempotencyKey }); },
  history(threadId: string) { return clientApi.communication.listMessages(threadId, { limit: 100 }); },
  listOlder(threadId: string, cursor: string) { return clientApi.communication.listMessages(threadId, { cursor, limit: 100 }); },
  markRead(threadId: string) { return clientApi.communication.markThreadRead(threadId); },
};
