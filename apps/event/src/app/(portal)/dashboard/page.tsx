import { EventDashboardHomeSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="dashboard" tab="overview" view="overview">
      <EventDashboardHomeSectionView />
    </EventDashboardRouteView>
  );
}
