"use client";

import { useInvalidate } from "@prism/portal-query";
import { NotificationCenter } from "@prism/ui/notifications";
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";
import { eventUnreadNotices } from "../data/event-notifications-unread-resource";
import { pmcmNoticeLink } from "../model/notice-link";

/** The signed-in PMCM or coordinator account's notifications. */
export function AccountNotificationsView({ role }: { role?: string }) {
  const invalidate = useInvalidate();
  return (
    <NotificationCenter
      actions={notificationPreferencesRepository}
      linkFor={(notice) => pmcmNoticeLink(notice.action, notice.eventId, role)}
      onChange={() => void invalidate(eventUnreadNotices, "signed-in")}
    />
  );
}
