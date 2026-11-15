import { EventDashboardNotificationsSectionView } from "@/features/event-dashboard/shell/views/sections/notifications-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardNotificationsPage() {
  return (
    <EventDashboardRouteView section="notifications" tab="overview" view="all">
      <EventDashboardNotificationsSectionView />
    </EventDashboardRouteView>
  );
}
