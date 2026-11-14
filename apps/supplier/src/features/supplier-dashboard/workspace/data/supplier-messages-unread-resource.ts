import { defineResource } from "@prism/portal-query";
import { CHAT_REFRESH_INTERVAL_MS } from "@prism/ui/chat";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierMessagesRepository } from "./supplier-messages-repository";

/** Unread messages across the supplier's booked events. Polled on the chat cadence, and only while the tab is visible. */
export const supplierUnreadMessages = defineResource({
  name: "supplier.messages-unread",
  pollMs: CHAT_REFRESH_INTERVAL_MS,
  fetch: (session: PrismAuthenticatedSession) => supplierMessagesRepository.unreadCount(session),
});
