import { EventDashboardEventWorkspaceView } from "@/features/event-dashboard/shell/views/sections/event-dashboard-event-workspace-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  return (
    <EventDashboardRouteView section="events" tab="coordinators" eventId={eventSlug} view="coordinators">
      <EventDashboardEventWorkspaceView />
    </EventDashboardRouteView>
  );
}
