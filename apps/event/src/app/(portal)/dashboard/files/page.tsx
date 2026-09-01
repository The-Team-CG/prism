import { EventDashboardFilesSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="files" tab="floorplans" view="all">
      <EventDashboardFilesSectionView />
    </EventDashboardRouteView>
  );
}
