"use client";

import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";

export function ClientNotificationsView() {
  return <NotificationPreferencesPanel actions={notificationPreferencesRepository} />;
}
