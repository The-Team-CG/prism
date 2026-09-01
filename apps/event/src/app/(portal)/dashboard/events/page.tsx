import { EventDashboardEventsListSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="events-list" tab="overview" view="all">
      <EventDashboardEventsListSectionView />
    </EventDashboardRouteView>
  );
}
