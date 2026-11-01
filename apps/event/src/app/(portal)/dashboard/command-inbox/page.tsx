import { EventDashboardCommandInboxSectionView } from "@/features/event-dashboard/shell/views/sections/command-inbox-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="command-inbox" tab="overview" view="all">
      <EventDashboardCommandInboxSectionView />
    </EventDashboardRouteView>
  );
}
