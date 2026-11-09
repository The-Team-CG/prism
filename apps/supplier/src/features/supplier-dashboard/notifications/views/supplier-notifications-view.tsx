"use client";

import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";

export function SupplierNotificationsView() {
  return <NotificationPreferencesPanel actions={notificationPreferencesRepository} />;
}
