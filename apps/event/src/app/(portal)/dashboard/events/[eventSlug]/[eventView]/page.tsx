import { EventDashboardEventWorkspaceView } from "@/features/event-dashboard/shell/views/sections/event-dashboard-event-workspace-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { eventRouteState } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ eventSlug: string; eventView: string }> }) {
  const { eventSlug, eventView } = await params;
  return (
    <EventDashboardRouteView {...eventRouteState(eventSlug, eventView)}>
      <EventDashboardEventWorkspaceView />
    </EventDashboardRouteView>
  );
}
