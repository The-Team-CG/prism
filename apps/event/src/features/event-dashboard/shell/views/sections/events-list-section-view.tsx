"use client";

import { useResource } from "@prism/portal-query";
import type { PrismFinanceDesk, PrismPmcmEventAttentionList, PrismPmcmEventSummary, PrismPmcmFileSummary } from "@prism/types";
import { useSearchParams } from "next/navigation";
import { EventArchiveSearchView } from "@/features/closure/archive";
import { financeDesk } from "@/features/finance/desk";
import { eventShortcutCounts, pmcmEventAttention, pmcmEventSummaries, pmcmFileSummaries, summariesByEvent } from "@/features/pmcm-overview";
import { selectEventsForView } from "../../model/event-dashboard-selectors";
import { EVENT_REGISTER_VIEWS, EventRegister, EventRegisterToolbar, type EventMoney, type EventRegisterData } from "./event-register";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

const ARCHIVE_VIEW = EVENT_REGISTER_VIEWS[EVENT_REGISTER_VIEWS.length - 1].href;

function registerData(
  eventIds: string[],
  attention: PrismPmcmEventAttentionList | undefined,
  desk: PrismFinanceDesk | undefined,
  finance: PrismPmcmEventSummary[] | undefined,
  files: PrismPmcmFileSummary[] | undefined,
): EventRegisterData {
  const financeByEvent = summariesByEvent(finance);
  const filesByEvent = new Map((files ?? []).map((item) => [item.eventId, item]));
  return {
    attention: attention ? new Map(attention.items.map((item) => [item.eventId, item])) : undefined,
    money: desk ? new Map(desk.events.map((item): [string, EventMoney] => [item.eventId, { billed: item.billed, paid: item.paid, checking: item.checking }])) : undefined,
    shortcuts: new Map(eventIds.map((id) => [id, eventShortcutCounts(financeByEvent.get(id), filesByEvent.get(id))])),
  };
}

export function EventDashboardEventsListSectionView() {
  const { events, eventsForView, navigateEvent } = useEventDashboardLoadedRouteViewModel();
  // Read from the router, so following the Archive tab (a link to this same page) switches the view at once.
  const part = useSearchParams().get("part");
  const attention = useResource(pmcmEventAttention, "signed-in");
  const desk = useResource(financeDesk, "signed-in");
  const money = useResource(pmcmEventSummaries, "signed-in");
  const files = useResource(pmcmFileSummaries, "signed-in");
  // Each tab says how many events it holds; Archive searches on its own, so it has no count.
  const viewCounts = Object.fromEntries(EVENT_REGISTER_VIEWS.filter((view) => view.href !== ARCHIVE_VIEW)
    .map((view) => [view.href, selectEventsForView(events, view.href.split("/")[3] ?? "all").length]));
  if (part === "archive") {
    return (
      <div className="grid gap-6">
        <EventRegisterToolbar activeId={ARCHIVE_VIEW} counts={viewCounts} />
        <EventArchiveSearchView />
      </div>
    );
  }
  const data = { ...registerData(eventsForView.map((event) => event.id), attention.data, desk.data, money.data?.items, files.data?.items), viewCounts };
  return <EventRegister events={eventsForView} data={data} onOpenEvent={(id) => navigateEvent(id, "overview")} />;
}
