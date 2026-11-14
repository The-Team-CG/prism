import type { CommunicationInboxQuery, CommunicationThreadStatus, CommunicationUnreadCountQuery } from '@prism/types';
import { copyStorageObjectToThread, getStorageObjectDownload, uploadCommunicationAttachment } from '@prism/api-client';
import { eventApi, storedEventAccessToken } from '@/lib/prism-api';

function eventOf(thread: { eventId?: string }) {
  if (!thread.eventId) throw new Error('This conversation has no event');
  return thread.eventId;
}

export const eventMessagesRepository = {
  list(eventId: string, request?: Partial<CommunicationInboxQuery>) { return eventApi.communication.listThreads(eventId, request); },
  inbox(request?: Partial<CommunicationInboxQuery>) { return eventApi.communication.listInbox(request); },
  thread(threadId: string) { return eventApi.communication.getThread(threadId); },
  unreadCount(query: CommunicationUnreadCountQuery) { return eventApi.communication.unreadCount(query); },
  readReceipts(threadId: string) { return eventApi.communication.readReceipts(threadId); },
  participants(eventId: string) { return eventApi.communication.listParticipants(eventId); },
  create(eventId: string, subject: string, participantActorIds: string[]) { return eventApi.communication.createThread({ eventId, subject, participantActorIds }); },
  send(threadId: string, body: string, key: string, attachmentObjectIds: string[]) { return eventApi.communication.sendMessage(threadId, { body, attachmentObjectIds, idempotencyKey: key }); },
  history(threadId: string) { return eventApi.communication.listMessages(threadId, { limit: 100 }); },
  listOlder(threadId: string, cursor: string) { return eventApi.communication.listMessages(threadId, { cursor, limit: 100 }); },
  markRead(threadId: string) { return eventApi.communication.markThreadRead(threadId); },
  addParticipants(threadId: string, actorIds: string[]) { return eventApi.communication.addParticipants(threadId, { actorIds }); },
  removeParticipant(threadId: string, actorId: string) { return eventApi.communication.removeParticipant(threadId, actorId); },
  setThreadStatus(threadId: string, status: CommunicationThreadStatus) { return eventApi.communication.setThreadStatus(threadId, status); },
  uploadAttachment(thread: { id: string; eventId?: string }, file: File) { return uploadCommunicationAttachment(file, { eventId: eventOf(thread), threadId: thread.id }, { authToken: storedEventAccessToken() }).then((stored) => stored.id); },
  copyAttachment(thread: { id: string; eventId?: string }, file: { id: string }) { return copyStorageObjectToThread(file.id, { threadId: thread.id }, { authToken: storedEventAccessToken() }).then((stored) => stored.id); },
  storedFiles(thread: { eventId?: string }) { return eventApi.events.storageObjects(eventOf(thread)).then((files) => files.filter((file) => file.lifecycleState === "stored")); },
  downloadAttachment(attachmentId: string) { return getStorageObjectDownload(attachmentId, { authToken: storedEventAccessToken() }); },
};
