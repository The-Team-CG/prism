"use client";

import { EventCalendarWorkspace } from "./event-calendar-workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardCalendarSectionView() {
  const {
    events,
    selectedEvent,
    navigateEvent,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <EventCalendarWorkspace
            events={events}
            selectedEventId={selectedEvent?.id}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
          />
  );
}
