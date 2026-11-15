"use client";

import { useInvalidate } from "@prism/portal-query";
import type { PrismAuthenticatedSession } from "@prism/types";
import { NotificationCenter } from "@prism/ui/notifications";
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";
import { supplierUnreadNotices } from "../data/supplier-notifications-unread-resource";
import { supplierNoticeLink } from "../model/notice-link";

export function SupplierNotificationsView({ session }: { session: PrismAuthenticatedSession }) {
  const invalidate = useInvalidate();
  return (
    <NotificationCenter
      actions={notificationPreferencesRepository}
      linkFor={(notice) => supplierNoticeLink(notice.action)}
      onChange={() => void invalidate(supplierUnreadNotices, session)}
    />
  );
}
