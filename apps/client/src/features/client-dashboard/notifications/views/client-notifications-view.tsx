"use client";

import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { NotificationInbox } from './notification-inbox';
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";

/** The shared panel is capped at half width; the client page gives its channels the full content width. */
export function ClientNotificationsView() {
  return (
    <div className="space-y-6 [&>section]:max-w-none">
      <NotificationInbox />
      <NotificationPreferencesPanel actions={notificationPreferencesRepository} />
    </div>
  );
}
