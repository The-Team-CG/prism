"use client";

import { useResource } from "@prism/portal-query";
import { messagesSummaryLabel, pmcmEventSummaries, summariesByEvent } from "@/features/pmcm-overview";
import { EventDestinationPicker } from "./event-destination-picker";
import { EventMessagesWorkspace } from "@/features/event-dashboard/messages/views/event-messages-workspace";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardMessagesSectionView() {
  const {
    selectedEvent,
    session,
    events,
    navigateEvent,
  } = useEventDashboardLoadedRouteViewModel();
  const summaries = useResource(pmcmEventSummaries, selectedEvent ? null : "signed-in");
  const byEvent = summariesByEvent(summaries.data?.items);
  return (

          selectedEvent ? (
            <EventMessagesWorkspace
              event={selectedEvent}
              session={session}
            />
          ) : (
            <EventDestinationPicker
              events={events}
              description="Client, supplier, coordinator, and internal threads belong to one event. Choose one to open its messages."
              actionLabel="Open messages"
              tab="activity"
              onOpenEvent={(eventId) => navigateEvent(eventId, "activity")}
              rowDetail={(event) => (summaries.status === "ready" ? messagesSummaryLabel(byEvent.get(event.id)) : null)}
            />
          )
  );
}
