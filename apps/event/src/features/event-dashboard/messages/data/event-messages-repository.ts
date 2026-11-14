import type { CommunicationUnreadCountQuery } from '@prism/types';
import { eventApi } from '@/lib/prism-api';

export const eventMessagesRepository = {
  list(eventId: string) { return eventApi.communication.listThreads(eventId); },
  inbox() { return eventApi.communication.listInbox(); },
  unreadCount(query: CommunicationUnreadCountQuery) { return eventApi.communication.unreadCount(query); },
  readReceipts(threadId: string) { return eventApi.communication.readReceipts(threadId); },
  participants(eventId: string) { return eventApi.communication.listParticipants(eventId); },
  create(eventId: string, subject: string, participantActorIds: string[]) { return eventApi.communication.createThread({ eventId, subject, participantActorIds }); },
  send(threadId: string, body: string, key: string) { return eventApi.communication.sendMessage(threadId, { body, idempotencyKey: key }); },
  history(threadId: string) { return eventApi.communication.listMessages(threadId, { limit: 100 }); },
  listOlder(threadId: string, cursor: string) { return eventApi.communication.listMessages(threadId, { cursor, limit: 100 }); },
  markRead(threadId: string) { return eventApi.communication.markThreadRead(threadId); },
};
