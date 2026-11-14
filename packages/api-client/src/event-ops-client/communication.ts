import type {
  CommunicationInboxQuery,
  PrismCommunicationInboxThread,
  PrismCommunicationThread,
  PrismCommunicationParticipantChoice,
  PrismCommunicationReadReceipt,
  PrismCommunicationUnreadCount,
  PrismCursorPage,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

/** Paging and search for the conversation lists; every field is optional and the API applies its defaults. */
type ThreadPageRequest = Partial<CommunicationInboxQuery>;

function pagePath(path: string, query: ThreadPageRequest = {}, eventId?: string) {
  const params = new URLSearchParams();
  if (eventId) params.set("eventId", eventId);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function createCommunicationClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "communication"> {
  return {
    communication: {
      readReceipts: (threadId, actor = {}) => prismRequest<PrismCommunicationReadReceipt[]>(actorPath(`/communication/threads/${encodeURIComponent(threadId)}/read-receipts`, actor), withBase(options)),
      listThreads: (eventId, query = {}, actor = {}) =>
        prismRequest<PrismCursorPage<PrismCommunicationThread>>(
          actorPath(pagePath("/communication/threads", query, eventId), actor),
          withBase(options),
        ),
      getThread: (threadId, actor = {}) =>
        prismRequest<PrismCommunicationThread>(
          actorPath(`/communication/threads/${encodeURIComponent(threadId)}`, actor),
          withBase(options),
        ),
      listInbox: (query = {}, actor = {}) =>
        prismRequest<PrismCursorPage<PrismCommunicationInboxThread>>(
          actorPath(pagePath("/communication/inbox", query), actor),
          withBase(options),
        ),
      unreadCount: (query = {}, actor = {}) =>
        prismRequest<PrismCommunicationUnreadCount>(
          actorPath(`/communication/unread-count${query.eventId ? `?eventId=${encodeURIComponent(query.eventId)}` : ""}`, actor),
          withBase(options),
        ),
      listParticipants: (eventId, actor = {}) =>
        prismRequest<PrismCommunicationParticipantChoice[]>(
          actorPath(
            `/communication/participants?eventId=${encodeURIComponent(eventId)}`,
            actor,
          ),
          withBase(options),
        ),
      createThread: (input, actor = {}) =>
        prismRequest<PrismCommunicationThread>(
          actorPath("/communication/threads", actor),
          withBase(options, { method: "POST", body: input }),
        ),
      sendMessage: (threadId, input, actor = {}) =>
        prismRequest<PrismCommunicationThread["messages"][number]>(
          actorPath(`/communication/threads/${threadId}/messages`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      listMessages: (threadId, query = {}, actor = {}) => {
        const params = new URLSearchParams();
        if (query.cursor) params.set("cursor", query.cursor);
        if (query.limit) params.set("limit", String(query.limit));
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return prismRequest<
          import("@prism/types").PrismCursorPage<
            PrismCommunicationThread["messages"][number]
          >
        >(
          actorPath(
            `/communication/threads/${threadId}/messages${suffix}`,
            actor,
          ),
          withBase(options),
        );
      },
      markThreadRead: (threadId, actor = {}) =>
        prismRequest<{ lastReadAt: string }>(
          actorPath(`/communication/threads/${threadId}/read`, actor),
          withBase(options, { method: "POST" }),
        ),
      addParticipants: (threadId, input, actor = {}) =>
        prismRequest<PrismCommunicationThread>(
          actorPath(`/communication/threads/${encodeURIComponent(threadId)}/participants`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      removeParticipant: (threadId, actorId, actor = {}) =>
        prismRequest<PrismCommunicationThread>(
          actorPath(`/communication/threads/${encodeURIComponent(threadId)}/participants/${encodeURIComponent(actorId)}`, actor),
          withBase(options, { method: "DELETE" }),
        ),
      setThreadStatus: (threadId, status, actor = {}) =>
        prismRequest<PrismCommunicationThread>(
          actorPath(`/communication/threads/${encodeURIComponent(threadId)}`, actor),
          withBase(options, { method: "PATCH", body: { status } }),
        ),
    },
  };
}
