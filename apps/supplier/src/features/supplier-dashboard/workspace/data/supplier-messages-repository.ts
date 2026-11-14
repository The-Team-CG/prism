import type { CommunicationInboxQuery, PrismAuthenticatedSession } from '@prism/types';
import { prismApi } from '@/lib/prism-api';

export const supplierMessagesRepository = {
  inbox(session: PrismAuthenticatedSession, request?: Partial<CommunicationInboxQuery>) { return prismApi.communicationInbox(session, request); },
  thread(threadId: string, session: PrismAuthenticatedSession) { return prismApi.communicationThread(threadId, session); },
  unreadCount(session: PrismAuthenticatedSession) { return prismApi.communicationUnreadCount(session); },
  create(eventId: string, subject: string, session: PrismAuthenticatedSession) { return prismApi.createCommunicationThread(eventId, subject, session); },
  send(threadId: string, body: string, key: string, session: PrismAuthenticatedSession) { return prismApi.sendCommunicationMessage(threadId, body, key, session); },
  history(threadId: string, session: PrismAuthenticatedSession) { return prismApi.communicationMessages(threadId, undefined, 100, session); },
  listOlder(threadId: string, cursor: string, session: PrismAuthenticatedSession) { return prismApi.communicationMessages(threadId, cursor, 100, session); },
  markRead(threadId: string, session: PrismAuthenticatedSession) { return prismApi.markCommunicationThreadRead(threadId, session); },
};
