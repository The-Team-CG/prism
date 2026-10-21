import { EventDashboardMessagesSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="messages" tab="activity" view="inbox">
      <EventDashboardMessagesSectionView />
    </EventDashboardRouteView>
  );
}
