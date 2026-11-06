import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardRunSheetView } from "@/features/event-dashboard/shell/views/sections/event-dashboard-event-workspace-view";
import { eventRouteState } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export default async function EventRunSheetRoutePage({ params, searchParams }: { params: Promise<{ eventSlug: string }>; searchParams: Promise<{ dayId?: string }> }) {
  const { eventSlug } = await params;
  const { dayId } = await searchParams;
  return (
    <EventDashboardRouteView {...eventRouteState(eventSlug, "run-sheet")}>
      <EventDashboardRunSheetView dayId={dayId} />
    </EventDashboardRouteView>
  );
}
