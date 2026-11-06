import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardSuppliersSectionView } from "@/features/event-dashboard/shell/views/sections/suppliers-section-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="suppliers" tab="overview" view="all">
      <EventDashboardSuppliersSectionView />
    </EventDashboardRouteView>
  );
}
