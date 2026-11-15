import { defineResource } from "@prism/portal-query";
import type { PrismAuthenticatedSession } from "@prism/types";
import { notificationPreferencesRepository } from "./notification-preferences-repository";

/** How many notifications the signed-in supplier has not opened, polled for the navigation badge while the tab is visible. */
export const supplierUnreadNotices = defineResource({
  name: "supplier.notifications-unread",
  pollMs: 30_000,
  fetch: (_session: PrismAuthenticatedSession) => notificationPreferencesRepository.unreadCount(),
});
