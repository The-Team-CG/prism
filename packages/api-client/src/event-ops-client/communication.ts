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
import { withBase } from "./shared";

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
      readReceipts: (threadId) => prismRequest<PrismCommunicationReadReceipt[]>(`/communication/threads/${encodeURIComponent(threadId)}/read-receipts`, withBase(options)),
      listThreads: (eventId, query = {}) =>
        prismRequest<PrismCursorPage<PrismCommunicationThread>>(
          pagePath("/communication/threads", query, eventId),
          withBase(options),
        ),
      getThread: (threadId) =>
        prismRequest<PrismCommunicationThread>(
          `/communication/threads/${encodeURIComponent(threadId)}`,
          withBase(options),
        ),
      listInbox: (query = {}) =>
        prismRequest<PrismCursorPage<PrismCommunicationInboxThread>>(
          pagePath("/communication/inbox", query),
          withBase(options),
        ),
      unreadCount: (query = {}) =>
        prismRequest<PrismCommunicationUnreadCount>(
          `/communication/unread-count${query.eventId ? `?eventId=${encodeURIComponent(query.eventId)}` : ""}`,
          withBase(options),
        ),
      listParticipants: (eventId) =>
        prismRequest<PrismCommunicationParticipantChoice[]>(
          `/communication/participants?eventId=${encodeURIComponent(eventId)}`,
          withBase(options),
        ),
      createThread: (input) =>
        prismRequest<PrismCommunicationThread>(
          "/communication/threads",
          withBase(options, { method: "POST", body: input }),
        ),
      sendMessage: (threadId, input) =>
        prismRequest<PrismCommunicationThread["messages"][number]>(
          `/communication/threads/${threadId}/messages`,
          withBase(options, { method: "POST", body: input }),
        ),
      listMessages: (threadId, query = {}) => {
        const params = new URLSearchParams();
        if (query.cursor) params.set("cursor", query.cursor);
        if (query.limit) params.set("limit", String(query.limit));
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return prismRequest<
          import("@prism/types").PrismCursorPage<
            PrismCommunicationThread["messages"][number]
          >
        >(
          `/communication/threads/${threadId}/messages${suffix}`,
          withBase(options),
        );
      },
      markThreadRead: (threadId) =>
        prismRequest<{ lastReadAt: string }>(
          `/communication/threads/${threadId}/read`,
          withBase(options, { method: "POST" }),
        ),
      addParticipants: (threadId, input) =>
        prismRequest<PrismCommunicationThread>(
          `/communication/threads/${encodeURIComponent(threadId)}/participants`,
          withBase(options, { method: "POST", body: input }),
        ),
      removeParticipant: (threadId, actorId) =>
        prismRequest<PrismCommunicationThread>(
          `/communication/threads/${encodeURIComponent(threadId)}/participants/${encodeURIComponent(actorId)}`,
          withBase(options, { method: "DELETE" }),
        ),
      setThreadStatus: (threadId, status) =>
        prismRequest<PrismCommunicationThread>(
          `/communication/threads/${encodeURIComponent(threadId)}`,
          withBase(options, { method: "PATCH", body: { status } }),
        ),
    },
  };
}
