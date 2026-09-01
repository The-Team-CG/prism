import { EventDashboardEventWorkspaceView, EventDashboardRouteView, eventRouteState } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ eventSlug: string; eventView: string }> }) {
  const { eventSlug, eventView } = await params;
  return (
    <EventDashboardRouteView {...eventRouteState(eventSlug, eventView)}>
      <EventDashboardEventWorkspaceView />
    </EventDashboardRouteView>
  );
}
