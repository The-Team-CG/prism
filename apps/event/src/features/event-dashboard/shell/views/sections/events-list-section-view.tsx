"use client";

import { useResource } from "@prism/portal-query";
import { EventRegister } from "./event-register";
import { EventArchiveSearchView } from "@/features/closure/archive";
import { eventAttentionLabels, pmcmEventSummaries, pmcmFileSummaries, summariesByEvent } from "@/features/pmcm-overview";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardEventsListSectionView() {
  const { eventsForView, navigateEvent } = useEventDashboardLoadedRouteViewModel();
  const money = useResource(pmcmEventSummaries, "signed-in");
  const files = useResource(pmcmFileSummaries, "signed-in");
  const financeByEvent = summariesByEvent(money.data?.items);
  const filesByEvent = new Map((files.data?.items ?? []).map((item) => [item.eventId, item]));
  // Until both reads land, an event has no label at all: a blank must not read as "nothing is overdue".
  const attention = money.data && files.data
    ? new Map(eventsForView.map((event) => [event.id, eventAttentionLabels(financeByEvent.get(event.id), filesByEvent.get(event.id))]))
    : undefined;
  return (
    <div className="grid gap-8">
      <EventRegister events={eventsForView} attention={attention} onOpenEvent={(id) => navigateEvent(id, "overview")} />
      <EventArchiveSearchView />
    </div>
  );
}
