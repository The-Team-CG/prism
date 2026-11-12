"use client";

import { EventMessagesWorkspace } from "@/features/event-dashboard/messages/views/event-messages-workspace";
import { orderPickerEvents } from "./event-destination-picker";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

/** Messages outside an event is one inbox across every event; inside an event it is that event's threads. */
export function EventDashboardMessagesSectionView() {
  const { selectedEvent, session, events } = useEventDashboardLoadedRouteViewModel();
  return <EventMessagesWorkspace key={selectedEvent?.id ?? "inbox"} event={selectedEvent ?? undefined} events={orderPickerEvents(events)} session={session} />;
}
