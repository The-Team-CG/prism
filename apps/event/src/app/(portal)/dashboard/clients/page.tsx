import { EventDashboardClientsSectionView } from "@/features/event-dashboard/shell/views/sections/clients-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="clients" tab="overview" view="all">
      <EventDashboardClientsSectionView />
    </EventDashboardRouteView>
  );
}
