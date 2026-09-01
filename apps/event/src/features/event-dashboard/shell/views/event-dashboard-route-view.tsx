"use client";

import type { ReactNode } from "react";
import { EventDashboardShellView } from "./event-dashboard-shell-view";
import { EventDashboardRouteContentView } from "./event-dashboard-route-content-view";
import { useEventDashboardShellViewModel } from "../view-models/use-event-dashboard-shell-view-model";
import type { EventDashboardClientProps } from "../model/event-dashboard-routing";

/**
 * Shared route runtime. App Router pages provide the explicit route state and
 * compose feature content as children; this component only owns the dashboard
 * ViewModel, shell chrome, error boundary, and route context.
 */
export function EventDashboardRouteView({ children, ...props }: EventDashboardClientProps & { children: ReactNode }) {
  const viewModel = useEventDashboardShellViewModel(props);

  return (
    <EventDashboardShellView viewModel={viewModel}>
      <EventDashboardRouteContentView viewModel={viewModel}>{children}</EventDashboardRouteContentView>
    </EventDashboardShellView>
  );
}
