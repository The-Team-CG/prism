import { EventDashboardRouteView, EventDashboardTasksSectionView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="tasks" tab="overview" view="mine">
      <EventDashboardTasksSectionView />
    </EventDashboardRouteView>
  );
}
