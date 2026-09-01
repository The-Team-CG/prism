import { EventDashboardRouteView, EventDashboardTasksSectionView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ taskView: string }> }) {
  const { taskView } = await params;
  return (
    <EventDashboardRouteView section="tasks" tab="overview" view={taskView}>
      <EventDashboardTasksSectionView />
    </EventDashboardRouteView>
  );
}
