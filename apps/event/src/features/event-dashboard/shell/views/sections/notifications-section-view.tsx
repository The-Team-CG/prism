"use client";

import { AccountNotificationsView } from "@/features/account-notifications/views/account-notifications-view";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

/** PMCM's notifications are the account's own, across every event, not a Settings tab. */
export function EventDashboardNotificationsSectionView() {
  const { session } = useEventDashboardLoadedRouteViewModel();
  return <AccountNotificationsView role={session.role} />;
}
