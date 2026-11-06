"use client";

import { EventCommandInbox } from "@/features/command-inbox/list";
import { useEventDashboardScopedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardCommandInboxSectionView() {
  const {
    commandInbox,
    refreshCommandInbox,
    changeCommandInboxPage,
    commandInboxLoadFailed,
  } = useEventDashboardScopedRouteViewModel();
  return (

          <EventCommandInbox
            inbox={commandInbox}
            onRefresh={() => refreshCommandInbox().catch(() => undefined)}
            onPageChange={(page) => changeCommandInboxPage(page).catch(() => undefined)}
            loadFailed={commandInboxLoadFailed}
          />
  );
}
