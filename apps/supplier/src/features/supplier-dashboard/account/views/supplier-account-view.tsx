"use client";

import { AccountScreen } from "@prism/ui/account-page";
import { NotificationPreferencesPanel } from "@prism/ui/notification-preferences";
import { notificationPreferencesRepository } from "../../notifications/data/notification-preferences-repository";
import { useSupplierAccountViewModel } from "../view-models/use-supplier-account-view-model";

/** The supplier's account, on the account page every portal shares. */
export function SupplierAccountView() {
  const vm = useSupplierAccountViewModel();
  return (
    <AccountScreen
      identity={vm.identity}
      loading={vm.loading}
      error={vm.error}
      security={vm.security}
      notifications={<NotificationPreferencesPanel actions={notificationPreferencesRepository} />}
      privacy={vm.privacy}
      contact={vm.contact}
      links={vm.links}
      today={vm.today}
      actions={vm.actions}
      signIns={vm.signIns}
      sessions={vm.sessions}
    />
  );
}
