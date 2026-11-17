"use client";

import { AccountScreen } from "@prism/ui/account-page";
import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { notificationPreferencesRepository } from "@/features/account-notifications/data/notification-preferences-repository";
import { useEventAccountViewModel } from "../view-models/use-event-account-view-model";

/** A PMCM staff member's or coordinator's account, on the account page every portal shares. */
export function EventAccountView() {
  const vm = useEventAccountViewModel();
  return (
    <AccountScreen
      identity={vm.identity}
      loading={vm.loading}
      error={vm.error}
      security={vm.security}
      notifications={<NotificationPreferencesPanel actions={notificationPreferencesRepository} />}
      privacy={null}
      contact={null}
      links={vm.links}
      today={vm.today}
    />
  );
}
