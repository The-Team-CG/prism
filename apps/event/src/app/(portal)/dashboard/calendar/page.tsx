import { EventDashboardCalendarSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="calendar" tab="overview" view="all">
      <EventDashboardCalendarSectionView />
    </EventDashboardRouteView>
  );
}
