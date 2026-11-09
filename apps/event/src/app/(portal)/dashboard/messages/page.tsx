import { EventDashboardMessagesSectionView } from "@/features/event-dashboard/shell/views/sections/messages-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="messages" tab="messages" view="inbox">
      <EventDashboardMessagesSectionView />
    </EventDashboardRouteView>
  );
}
