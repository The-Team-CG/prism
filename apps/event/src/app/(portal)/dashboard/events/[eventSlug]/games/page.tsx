import { EventDashboardEventWorkspaceView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardGamesPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  return (
    <EventDashboardRouteView section="events" tab="games" eventId={eventSlug} view="games">
      <EventDashboardEventWorkspaceView />
    </EventDashboardRouteView>
  );
}
