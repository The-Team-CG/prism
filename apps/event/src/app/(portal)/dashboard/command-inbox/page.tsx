import { EventDashboardCommandInboxSectionView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="command-inbox" tab="overview" view="all">
      <EventDashboardCommandInboxSectionView />
    </EventDashboardRouteView>
  );
}
