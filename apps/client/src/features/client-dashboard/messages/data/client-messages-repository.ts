import type { CommunicationInboxQuery, CommunicationUnreadCountQuery } from '@prism/types';
import { copyStorageObjectToThread, getStorageObjectDownload, uploadCommunicationAttachment } from '@prism/api-client';
import { clientApi, storedClientAccessToken } from '@/lib/prism-api';

function eventOf(thread: { eventId?: string }) {
  if (!thread.eventId) throw new Error('This conversation has no event');
  return thread.eventId;
}

export const clientMessagesRepository = {
  list(eventId: string, request?: Partial<CommunicationInboxQuery>) { return clientApi.communication.listThreads(eventId, request); },
  inbox(request?: Partial<CommunicationInboxQuery>) { return clientApi.communication.listInbox(request); },
  thread(threadId: string) { return clientApi.communication.getThread(threadId); },
  unreadCount(query: CommunicationUnreadCountQuery) { return clientApi.communication.unreadCount(query); },
  send(threadId: string, body: string, idempotencyKey: string, attachmentObjectIds: string[]) { return clientApi.communication.sendMessage(threadId, { body, attachmentObjectIds, idempotencyKey }); },
  history(threadId: string) { return clientApi.communication.listMessages(threadId, { limit: 100 }); },
  listOlder(threadId: string, cursor: string) { return clientApi.communication.listMessages(threadId, { cursor, limit: 100 }); },
  markRead(threadId: string) { return clientApi.communication.markThreadRead(threadId); },
  uploadAttachment(thread: { id: string; eventId?: string }, file: File) { return uploadCommunicationAttachment(file, { eventId: eventOf(thread), threadId: thread.id }, { authToken: storedClientAccessToken() }).then((stored) => stored.id); },
  copyAttachment(thread: { id: string; eventId?: string }, file: { id: string }) { return copyStorageObjectToThread(file.id, { threadId: thread.id }, { authToken: storedClientAccessToken() }).then((stored) => stored.id); },
  storedFiles(thread: { eventId?: string }) { return clientApi.events.storageObjects(eventOf(thread)).then((files) => files.filter((file) => file.lifecycleState === "stored")); },
  downloadAttachment(attachmentId: string) { return getStorageObjectDownload(attachmentId, { authToken: storedClientAccessToken() }); },
};
