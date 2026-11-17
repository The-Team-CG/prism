"use client";

import { AccountScreen } from "@prism/ui/account-page";
import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { notificationPreferencesRepository } from "../../notifications/data/notification-preferences-repository";
import { useClientAccountViewModel } from "../view-models/use-client-account-view-model";

/** The client's account, on the account page every portal shares. */
export function ClientAccountView() {
  const vm = useClientAccountViewModel();
  return (
    <AccountScreen
      identity={vm.identity}
      loading={vm.loading}
      error={vm.error}
      security={vm.security}
      notifications={<NotificationPreferencesPanel actions={notificationPreferencesRepository} />}
      privacy={vm.privacy}
      contact={vm.contact}
      links={[]}
      today={vm.today}
      actions={vm.actions}
      signIns={vm.signIns}
    />
  );
}
