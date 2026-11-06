import { redirect } from "next/navigation";
import { EventDashboardEventsListSectionView } from "@/features/event-dashboard/shell/views/sections/events-list-section-view";
import { EventDashboardRouteView } from "@/features/event-dashboard/shell/views/event-dashboard-route-view";
import { eventListRouteState, isEventListView } from "@/features/event-dashboard/shell/model/event-dashboard-routing";

export default async function EventRouteIndex({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  if (isEventListView(eventSlug)) {
    return (
      <EventDashboardRouteView {...eventListRouteState(eventSlug)}>
        <EventDashboardEventsListSectionView />
      </EventDashboardRouteView>
    );
  }

  redirect(`/dashboard/events/${encodeURIComponent(eventSlug)}/overview`);
}
