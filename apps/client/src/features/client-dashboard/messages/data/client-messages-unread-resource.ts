import { defineResource } from "@prism/portal-query";
import { CHAT_REFRESH_INTERVAL_MS } from "@prism/ui/chat";
import type { CommunicationUnreadCountQuery } from "@prism/types";
import { clientMessagesRepository } from "./client-messages-repository";

/** Unread messages: the account's inbox total, or one event's when keyed by `eventId`. Polled on the chat cadence, visible tabs only. */
export const clientUnreadMessages = defineResource({
  name: "client.messages-unread",
  pollMs: CHAT_REFRESH_INTERVAL_MS,
  fetch: (query: CommunicationUnreadCountQuery) => clientMessagesRepository.unreadCount(query),
});
