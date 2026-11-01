import { EventDashboardHomeSectionView } from "@/features/event-dashboard/shell/views/sections/home-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="dashboard" tab="overview" view="overview">
      <EventDashboardHomeSectionView />
    </EventDashboardRouteView>
  );
}
