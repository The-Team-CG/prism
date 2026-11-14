import type { CommunicationInboxQuery, PrismAuthenticatedSession } from '@prism/types';
import { copyStorageObjectToThread, getStorageObjectDownload, uploadCommunicationAttachment } from '@prism/api-client';
import { eventOpsClient, prismApi } from '@/lib/prism-api';

function eventOf(thread: { eventId?: string }) {
  if (!thread.eventId) throw new Error('This conversation has no event');
  return thread.eventId;
}

export const supplierMessagesRepository = {
  inbox(session: PrismAuthenticatedSession, request?: Partial<CommunicationInboxQuery>) { return prismApi.communicationInbox(session, request); },
  thread(threadId: string, session: PrismAuthenticatedSession) { return prismApi.communicationThread(threadId, session); },
  unreadCount(session: PrismAuthenticatedSession) { return prismApi.communicationUnreadCount(session); },
  create(eventId: string, subject: string, session: PrismAuthenticatedSession) { return prismApi.createCommunicationThread(eventId, subject, session); },
  send(threadId: string, body: string, key: string, attachmentIds: string[], session: PrismAuthenticatedSession) { return prismApi.sendCommunicationMessage(threadId, body, key, session, attachmentIds); },
  history(threadId: string, session: PrismAuthenticatedSession) { return prismApi.communicationMessages(threadId, undefined, 100, session); },
  listOlder(threadId: string, cursor: string, session: PrismAuthenticatedSession) { return prismApi.communicationMessages(threadId, cursor, 100, session); },
  markRead(threadId: string, session: PrismAuthenticatedSession) { return prismApi.markCommunicationThreadRead(threadId, session); },
  uploadAttachment(thread: { id: string; eventId?: string }, file: File, session: PrismAuthenticatedSession) { return uploadCommunicationAttachment(file, { eventId: eventOf(thread), threadId: thread.id }, { authToken: session.accessToken }).then((stored) => stored.id); },
  copyAttachment(thread: { id: string; eventId?: string }, file: { id: string }, session: PrismAuthenticatedSession) { return copyStorageObjectToThread(file.id, { threadId: thread.id }, { authToken: session.accessToken }).then((stored) => stored.id); },
  storedFiles(thread: { eventId?: string }) { return eventOpsClient.events.storageObjects(eventOf(thread)).then((files) => files.filter((file) => file.lifecycleState === "stored")); },
  downloadAttachment(attachmentId: string, session: PrismAuthenticatedSession) { return getStorageObjectDownload(attachmentId, { authToken: session.accessToken }); },
};
