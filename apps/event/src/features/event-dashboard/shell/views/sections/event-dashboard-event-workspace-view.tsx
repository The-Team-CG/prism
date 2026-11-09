"use client";

import type { ReactElement } from "react";
import { eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";
import { EmptyEventWorkspace } from "./event-workspace-header";
import {
  EventWorkspaceMessagesTab,
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
import { EventDashboardFilesSectionView } from "./files-section-view";
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
  messages: () => <EventWorkspaceMessagesTab />,
};

/** PMCM print-friendly run sheet for the selected event (FL-026). */
export function EventDashboardRunSheetView({ dayId }: { dayId?: string }) {
  const { selectedEvent } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return <EmptyEventWorkspace />;
  // The run sheet is its own page: the event name is already the page title, so no second header card.
  return <LiveOpsRunSheet eventId={selectedEvent.id} dayId={dayId} printable scheduleHref={eventWorkspaceHref(selectedEvent.id, "live-ops")} calendarHref="/dashboard/calendar" />;
}

export function EventDashboardEventWorkspaceView() {
  const { selectedEvent, tab } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return <EmptyEventWorkspace />;
  const renderTab = EVENT_TAB_VIEWS[tab];
  return (
    <div className="space-y-5">
      {renderTab ? renderTab() : null}
    </div>
  );
}
