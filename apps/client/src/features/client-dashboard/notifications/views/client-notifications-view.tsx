"use client";

import { useInvalidate } from "@prism/portal-query";
import { NotificationCenter } from "@prism/ui/notifications";
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";
import { clientUnreadNotices } from "../data/client-notifications-unread-resource";
import { clientNoticeLink } from "../model/notice-link";

export function ClientNotificationsView() {
  const invalidate = useInvalidate();
  return (
    <NotificationCenter
      actions={notificationPreferencesRepository}
      linkFor={(notice) => clientNoticeLink(notice.action)}
      onChange={() => void invalidate(clientUnreadNotices, "signed-in")}
    />
  );
}
