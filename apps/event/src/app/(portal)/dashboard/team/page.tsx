import { EventDashboardRouteView, EventDashboardTeamSectionView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return (
    <EventDashboardRouteView section="team" tab="coordinators" view="all">
      <EventDashboardTeamSectionView />
    </EventDashboardRouteView>
  );
}
