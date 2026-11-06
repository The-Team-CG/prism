"use client";

import { AuditTrailPanel } from "@/features/audit/trail";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardAuditSectionView() {
  const {
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <AuditTrailPanel />
  );
}
