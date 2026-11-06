import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardTasksSectionView } from "@/features/event-dashboard/shell/views/sections/tasks-section-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="tasks" tab="overview" view="mine">
      <EventDashboardTasksSectionView />
    </EventDashboardRouteView>
  );
}
