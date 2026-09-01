import { EventDashboardRouteView, EventDashboardTeamSectionView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ teamView: string }> }) {
  const { teamView } = await params;
  return (
    <EventDashboardRouteView section="team" tab="coordinators" view={teamView}>
      <EventDashboardTeamSectionView />
    </EventDashboardRouteView>
  );
}
