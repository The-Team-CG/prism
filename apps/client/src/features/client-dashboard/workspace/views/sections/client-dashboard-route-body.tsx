"use client";

import type { ReactElement } from "react";
import { ClientHomeView } from "../../../home";
import { ClientEventsView } from "../../../events";
import { ClientRequestView } from "../../../request";
import { ClientCalendarView } from "../../../calendar";
import { ClientApprovalsView } from "../../../approvals";
import { ClientFilesView } from "../../../files";
import { ClientMessagesView } from "../../../messages";
import { ClientPortalBillingView } from "../../../billing";
import { ClientEventWorkspaceView } from "../../../event-workspace";
import { ClientSharedFloorplansView } from "@/features/client-shared-floorplans/views/client-shared-floorplans-view";
import type { ClientDashboardRoute } from "../../model/client-dashboard-types";

const PORTAL_ROUTE_VIEWS: Partial<Record<ClientDashboardRoute, () => ReactElement>> = {
  home: () => <ClientHomeView />,
  "shared-floorplans": () => <ClientSharedFloorplansView />,
  request: () => <ClientRequestView />,
  events: () => <ClientEventsView />,
  calendar: () => <ClientCalendarView />,
  files: () => <ClientFilesView />,
};

const PORTAL_ONLY_VIEWS: Partial<Record<ClientDashboardRoute, () => ReactElement>> = {
  approvals: () => <ClientApprovalsView />,
  messages: () => <ClientMessagesView />,
  billing: () => <ClientPortalBillingView />,
};

export function ClientDashboardRouteBody({
  route,
  isEventScopedView,
}: {
  route: ClientDashboardRoute;
  isEventScopedView: boolean;
}) {
  if (isEventScopedView) return <ClientEventWorkspaceView />;
  const portalOnly = PORTAL_ONLY_VIEWS[route];
  if (portalOnly) return portalOnly();
  const portalView = PORTAL_ROUTE_VIEWS[route];
  return portalView ? portalView() : null;
}
