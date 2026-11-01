import { EventDashboardHomeSectionView } from "@/features/event-dashboard/shell/views/sections/home-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { dashboardRouteState } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ dashboardView: string }> }) {
  const { dashboardView } = await params;
  return (
    <EventDashboardRouteView {...dashboardRouteState(dashboardView)}>
      <EventDashboardHomeSectionView />
    </EventDashboardRouteView>
  );
}
