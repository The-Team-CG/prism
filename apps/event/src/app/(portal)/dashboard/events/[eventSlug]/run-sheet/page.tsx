import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { EventDashboardRunSheetView } from "@/features/event-dashboard/shell/views/sections/event-dashboard-event-workspace-view";
import { eventRouteState } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export default async function EventRunSheetRoutePage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  return (
    <EventDashboardRouteView {...eventRouteState(eventSlug, "run-sheet")}>
      <EventDashboardRunSheetView />
    </EventDashboardRouteView>
  );
}
