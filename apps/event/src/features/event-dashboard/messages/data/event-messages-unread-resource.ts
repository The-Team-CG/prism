import { defineResource } from "@prism/portal-query";
import { CHAT_REFRESH_INTERVAL_MS } from "@prism/ui/chat";
import { eventMessagesRepository } from "./event-messages-repository";

/** Unread messages across the PMCM or coordinator inbox. Polled on the chat cadence, and only while the tab is visible. */
export const eventUnreadMessages = defineResource({
  name: "event.messages-unread",
  pollMs: CHAT_REFRESH_INTERVAL_MS,
  fetch: () => eventMessagesRepository.unreadCount(),
});
