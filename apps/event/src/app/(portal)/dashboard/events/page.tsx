import { EventDashboardEventsListSectionView } from "@/features/event-dashboard/shell/views/sections/events-list-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="events-list" tab="overview" view="all">
      <EventDashboardEventsListSectionView />
    </EventDashboardRouteView>
  );
}
