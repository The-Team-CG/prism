import { redirect } from "next/navigation";
import {
  EventDashboardEventsListSectionView,
  EventDashboardRouteView,
  eventListRouteState,
  isEventListView,
} from "@/features/event-dashboard/shell";

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
