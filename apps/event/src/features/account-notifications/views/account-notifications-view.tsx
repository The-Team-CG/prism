"use client";

import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { NotificationInbox } from './notification-inbox';
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";

export function AccountNotificationsView() {
  return <div className="space-y-5"><NotificationInbox /><NotificationPreferencesPanel actions={notificationPreferencesRepository} /></div>;
}
