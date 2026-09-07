import type { PrismCommunicationThread, PrismCursorPage } from '@prism/types';
import { prismApi } from '@/lib/prism-api';

export const eventMessagesRepository = {
  list(eventId: string) { return prismApi.communicationThreads(eventId); },
  participants(eventId: string) { return prismApi.communicationParticipants(eventId); },
  create(eventId: string, subject: string, participantActorIds: string[]) { return prismApi.createCommunicationThread(eventId, subject, participantActorIds); },
  send(threadId: string, body: string, key: string) { return prismApi.sendCommunicationMessage(threadId, body, key); },
  listOlder(threadId: string, cursor: string): Promise<PrismCursorPage<PrismCommunicationThread['messages'][number]>> { return prismApi.communicationMessages(threadId, cursor, 100); },
  markRead(threadId: string) { return prismApi.markCommunicationThreadRead(threadId); },
};
