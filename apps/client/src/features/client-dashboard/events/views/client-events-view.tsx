"use client";

import Link from "next/link";
import { CalendarDays, Search, Send } from "lucide-react";
import { manilaDateKey } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { selectClientEventHistoryEvents, clientEventMatchesFilter } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { orderClientEvents } from "../../home/model/client-home-summary";
import { ClientEventCards } from "./client-event-cards";
import { clientEventsEmptyCopy, type ClientEventsFilterId } from "../model/client-events-empty-copy";

type EventFilterOption = {
  id: ClientEventsFilterId;
  label: string;
  href: string;
  matches: (ev: PrismEvent) => boolean;
};

const EVENT_FILTER_OPTIONS: EventFilterOption[] = [
  { id: "events-all", label: "All", href: "/dashboard/events", matches: (ev) => clientEventMatchesFilter(ev, "events-all") },
  { id: "events-upcoming", label: "Upcoming", href: "/dashboard/events/upcoming", matches: (ev) => clientEventMatchesFilter(ev, "events-upcoming") },
  { id: "events-in-planning", label: "In planning", href: "/dashboard/events/in-planning", matches: (ev) => clientEventMatchesFilter(ev, "events-in-planning") },
  { id: "events-completed", label: "Completed", href: "/dashboard/events/completed", matches: (ev) => clientEventMatchesFilter(ev, "events-completed") },
  { id: "events-cancelled", label: "Cancelled", href: "/dashboard/events/cancelled", matches: (ev) => clientEventMatchesFilter(ev, "events-cancelled") },
];

function isEventsFilterId(value: string | undefined): value is ClientEventsFilterId {
  return EVENT_FILTER_OPTIONS.some((option) => option.id === value);
}

/** The filter a portal view names; "upcoming" also answers to the home page's upcoming-events link. */
function activeFilterId(portalView: string | undefined): ClientEventsFilterId {
  if (portalView === "dashboard-upcoming-events") return "events-upcoming";
  return isEventsFilterId(portalView) ? portalView : "events-all";
}

export function ClientEventsView() {
  const { portalView, state, session, actionCenter, setSelectedEventId, eventSearch, setEventSearch } = useClientWorkspace();
  if (!state) return null;
  const historyEvents = selectClientEventHistoryEvents(state, session);

  const activeEventFilterId = activeFilterId(portalView);
  const activeEventFilter = EVENT_FILTER_OPTIONS.find((option) => option.id === activeEventFilterId) ?? EVENT_FILTER_OPTIONS[0];
  const query = eventSearch.trim().toLowerCase();
  const searching = Boolean(query);
  const visibleEvents = historyEvents.filter((ev) => {
    if (!activeEventFilter.matches(ev)) return false;
    if (!query) return true;
    return `${ev.eventName} ${ev.eventDate} ${ev.status}`.toLowerCase().includes(query);
  });
  const emptyCopy = clientEventsEmptyCopy(activeEventFilterId, searching);

  const todayKey = manilaDateKey();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Filters change the route, so they are route-linked tabs that open in new tabs and keep the active state readable. */}
        <ClientRouteTabs
          label="Event status filters"
          activeId={activeEventFilterId}
          tabs={EVENT_FILTER_OPTIONS.map((filter) => ({
            id: filter.id,
            label: filter.label,
            href: filter.href,
            count: historyEvents.filter(filter.matches).length,
          }))}
        />
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <label htmlFor="client-event-search" className="sr-only">Search events</label>
          <div className="relative min-w-0 flex-1 sm:w-72">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client-event-search"
              type="search"
              value={eventSearch}
              onChange={(ev) => setEventSearch(ev.target.value)}
              placeholder="Search events"
              className="h-9 w-full rounded-md pl-9"
            />
          </div>
          {emptyCopy.offersNewRequest ? (
            <Button asChild size="sm" className="shrink-0"><Link href="/dashboard/request"><Send className="size-4" /> New request</Link></Button>
          ) : null}
        </div>
      </div>

      {visibleEvents.length ? (
        <section aria-labelledby="client-events-list" className="grid gap-3">
          <h2 id="client-events-list" className="flex items-baseline gap-2 text-base font-semibold text-foreground">
            {activeEventFilter.label === "All" ? "All events" : activeEventFilter.label}
            <span className="text-sm font-normal tabular-nums text-muted-foreground">{visibleEvents.length}</span>
          </h2>
          <ClientEventCards events={orderClientEvents(visibleEvents)} actions={actionCenter?.items ?? []} todayKey={todayKey} onOpen={setSelectedEventId} featureFirst={!searching} />
        </section>
      ) : (
        <ClientListEmpty
          icon={CalendarDays}
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={emptyCopy.offersNewRequest ? <Button asChild size="sm"><Link href="/dashboard/request"><Send className="size-4" /> New event request</Link></Button> : undefined}
        />
      )}
    </div>
  );
}
