import { EventDashboardHomeSectionView, EventDashboardRouteView, dashboardRouteState } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ dashboardView: string }> }) {
  const { dashboardView } = await params;
  return (
    <EventDashboardRouteView {...dashboardRouteState(dashboardView)}>
      <EventDashboardHomeSectionView />
    </EventDashboardRouteView>
  );
}
