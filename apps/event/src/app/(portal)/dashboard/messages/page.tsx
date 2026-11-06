import { EventDashboardMessagesSectionView } from "@/features/event-dashboard/shell/views/sections/messages-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="messages" tab="activity" view="inbox">
      <EventDashboardMessagesSectionView />
    </EventDashboardRouteView>
  );
}
