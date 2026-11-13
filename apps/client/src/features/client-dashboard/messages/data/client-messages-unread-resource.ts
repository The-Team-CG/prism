import { defineResource } from "@prism/portal-query";
import { CHAT_REFRESH_INTERVAL_MS } from "@prism/ui/chat";
import { clientMessagesRepository } from "./client-messages-repository";

/** Unread messages across the account's inbox. Polled on the chat cadence, and only while the tab is visible. */
export const clientUnreadMessages = defineResource({
  name: "client.messages-unread",
  pollMs: CHAT_REFRESH_INTERVAL_MS,
  fetch: () => clientMessagesRepository.unreadCount(),
});
