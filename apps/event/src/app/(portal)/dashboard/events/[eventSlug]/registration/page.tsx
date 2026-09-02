import { EventDashboardEventWorkspaceView, EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default async function EventDashboardRoutePage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  return (
    <EventDashboardRouteView section="events" tab="registration" eventId={eventSlug} view="registration">
      <EventDashboardEventWorkspaceView />
    </EventDashboardRouteView>
  );
}
