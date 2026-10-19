"use client";

import type { ReactElement } from "react";
import type { DetailTab } from "../../model/event-dashboard-routing";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
import { EmptyEventWorkspace, EventWorkspaceHeader } from "./event-workspace-header";
import {
  EventWorkspaceActivityTab,
  EventWorkspaceBillingTab,
  EventWorkspaceBriefingTab,
  EventWorkspaceClosureTab,
  EventWorkspaceCoordinatorsTab,
  EventWorkspaceDecisionsTab,
  EventWorkspaceFloorplansTab,
  EventWorkspaceGamesTab,
  EventWorkspaceLiveOpsTab,
  EventWorkspaceOverviewTab,
  EventWorkspaceRegistrationTab,
  EventWorkspaceSuppliersTab,
} from "./event-workspace-tabs";
import { EventDashboardFilesSectionView } from "./event-dashboard-section-views";

const EVENT_TAB_VIEWS: Record<DetailTab, () => ReactElement> = {
  overview: () => <EventWorkspaceOverviewTab />,
  files: () => <EventDashboardFilesSectionView />,
  floorplans: () => <EventWorkspaceFloorplansTab />,
  games: () => <EventWorkspaceGamesTab />,
  briefing: () => <EventWorkspaceBriefingTab />,
  suppliers: () => <EventWorkspaceSuppliersTab />,
  registration: () => <EventWorkspaceRegistrationTab />,
  coordinators: () => <EventWorkspaceCoordinatorsTab />,
  "live-ops": () => <EventWorkspaceLiveOpsTab />,
  billing: () => <EventWorkspaceBillingTab />,
  closure: () => <EventWorkspaceClosureTab />,
  decisions: () => <EventWorkspaceDecisionsTab />,
  activity: () => <EventWorkspaceActivityTab />,
};

export function EventDashboardEventWorkspaceView() {
  const { selectedEvent, tab } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return <EmptyEventWorkspace />;
  const renderTab = EVENT_TAB_VIEWS[tab];
  return (
    <div className="space-y-5">
      <EventWorkspaceHeader />
      {renderTab ? renderTab() : null}
    </div>
  );
}
