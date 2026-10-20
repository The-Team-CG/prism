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
import { LiveOpsRunSheet } from "@/features/live-ops/schedule";

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

/** PMCM print-friendly run sheet for the selected event (FL-026). */
export function EventDashboardRunSheetView() {
  const { selectedEvent } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return <EmptyEventWorkspace />;
  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <EventWorkspaceHeader />
      </div>
      <LiveOpsRunSheet eventId={selectedEvent.id} printable />
    </div>
  );
}

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
