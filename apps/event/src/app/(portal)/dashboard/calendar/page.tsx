import { EventDashboardCalendarSectionView } from "@/features/event-dashboard/shell/views/sections/calendar-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="calendar" tab="overview" view="all">
      <EventDashboardCalendarSectionView />
    </EventDashboardRouteView>
  );
}
