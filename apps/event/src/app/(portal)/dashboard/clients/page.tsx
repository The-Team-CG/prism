import { EventDashboardClientsSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="clients" tab="overview" view="all">
      <EventDashboardClientsSectionView />
    </EventDashboardRouteView>
  );
}
