import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardTeamSectionView } from "@/features/event-dashboard/shell/views/sections/team-section-view";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="team" tab="coordinators" view="all">
      <EventDashboardTeamSectionView />
    </EventDashboardRouteView>
  );
}
