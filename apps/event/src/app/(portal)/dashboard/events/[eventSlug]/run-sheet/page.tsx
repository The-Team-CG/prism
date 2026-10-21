import { EventDashboardRouteView, EventDashboardRunSheetView, eventRouteState } from "@/features/event-dashboard/shell";

export default async function EventRunSheetRoutePage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  return (
    <EventDashboardRouteView {...eventRouteState(eventSlug, "run-sheet")}>
      <EventDashboardRunSheetView />
    </EventDashboardRouteView>
  );
}
