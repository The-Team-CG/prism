"use client";

import { SupplierDirectory } from "@/features/suppliers/directory";
import { useEventDashboardRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardSuppliersSectionView() {
  const viewModel = useEventDashboardRouteViewModel();
  return <SupplierDirectory
    view={viewModel.routeState.view ?? "all"}
    session={viewModel.session}
    onOpenEvent={(eventId) => viewModel.navigateEvent(eventId, "suppliers")}
  />;
}
