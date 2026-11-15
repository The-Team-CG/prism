import { defineResource } from "@prism/portal-query";
import { notificationPreferencesRepository } from "./notification-preferences-repository";

/** How many notifications the signed-in client has not opened, polled for the navigation badge while the tab is visible. */
export const clientUnreadNotices = defineResource({
  name: "client.notifications-unread",
  pollMs: 30_000,
  fetch: (_account: "signed-in") => notificationPreferencesRepository.unreadCount(),
});
