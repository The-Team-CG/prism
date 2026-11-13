import type {
  PrismCommunicationInboxThread,
  PrismCommunicationThread,
  PrismCommunicationParticipantChoice,
  PrismCommunicationReadReceipt,
  PrismCommunicationUnreadCount,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createCommunicationClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "communication"> {
  return {
    communication: {
      readReceipts: (threadId, actor = {}) => prismRequest<PrismCommunicationReadReceipt[]>(actorPath(`/communication/threads/${encodeURIComponent(threadId)}/read-receipts`, actor), withBase(options)),
      listThreads: (eventId, actor = {}) =>
        prismRequest<PrismCommunicationThread[]>(
          actorPath(
            `/communication/threads?eventId=${encodeURIComponent(eventId)}`,
            actor,
          ),
          withBase(options),
        ),
      listInbox: (actor = {}) =>
        prismRequest<PrismCommunicationInboxThread[]>(
          actorPath("/communication/inbox", actor),
          withBase(options),
        ),
      unreadCount: (actor = {}) =>
        prismRequest<PrismCommunicationUnreadCount>(
          actorPath("/communication/unread-count", actor),
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
    },
  };
}
