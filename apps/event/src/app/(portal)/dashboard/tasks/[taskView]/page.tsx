import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardTasksSectionView } from "@/features/event-dashboard/shell/views/sections/tasks-section-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ taskView: string }> }) {
  const { taskView } = await params;
  return (
    <EventDashboardRouteView section="tasks" tab="overview" view={taskView}>
      <EventDashboardTasksSectionView />
    </EventDashboardRouteView>
  );
}
