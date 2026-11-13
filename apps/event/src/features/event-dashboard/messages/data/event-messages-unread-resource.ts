import { defineResource } from "@prism/portal-query";
import { CHAT_REFRESH_INTERVAL_MS } from "@prism/ui/chat";
import type { CommunicationUnreadCountQuery } from "@prism/types";
import { eventMessagesRepository } from "./event-messages-repository";

/** Unread messages: the inbox's total, or one event's when keyed by `eventId`. Polled on the chat cadence, visible tabs only. */
export const eventUnreadMessages = defineResource({
  name: "event.messages-unread",
  pollMs: CHAT_REFRESH_INTERVAL_MS,
  fetch: (query: CommunicationUnreadCountQuery) => eventMessagesRepository.unreadCount(query),
});
