import { EventDashboardFilesSectionView } from "@/features/event-dashboard/shell/views/sections/files-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="files" tab="floorplans" view="all">
      <EventDashboardFilesSectionView />
    </EventDashboardRouteView>
  );
}
