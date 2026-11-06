import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardTeamSectionView } from "@/features/event-dashboard/shell/views/sections/team-section-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ teamView: string }> }) {
  const { teamView } = await params;
  return (
    <EventDashboardRouteView section="team" tab="coordinators" view={teamView}>
      <EventDashboardTeamSectionView />
    </EventDashboardRouteView>
  );
}
