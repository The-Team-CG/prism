"use client";

import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { notificationPreferencesRepository } from "../data/notification-preferences-repository";

/** The shared panel is capped at half width; the client page gives its channels the full content width. */
export function ClientNotificationsView() {
  return (
    <div className="[&>section]:max-w-none">
      <NotificationPreferencesPanel actions={notificationPreferencesRepository} />
    </div>
  );
}
