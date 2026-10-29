"use client";

import Link from "next/link";
import { CalendarCheck, CalendarDays, Search, Send } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/components/ui/utils";
import {
  clientEventCardOpenRoute,
  dashboardHref,
  selectClientEventHistoryEvents,
  clientEventMatchesFilter,
} from "../../workspace/shared";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientListEmpty, ClientListRow, ClientListSection } from "../../shared/client-list-ui";
import { eventCountdown, isPastClientEvent, orderClientEvents } from "../../home/model/client-home-summary";

export function ClientEventsView() {
  const {
    portalView,
    state,
    session,
    actionCenter,
    setSelectedEventId,
    eventSearch,
    setEventSearch,
  } = useClientWorkspace();
  if (!state) return null;
  const historyEvents = selectClientEventHistoryEvents(state, session);

    type EventFilterId = "events-all" | "events-upcoming" | "events-in-planning" | "events-completed" | "events-cancelled";
    const eventFilterOptions: Array<{
      id: EventFilterId;
      label: string;
      href: string;
      matches: (ev: PrismEvent) => boolean;
    }> = [
      { id: "events-all", label: "All", href: "/dashboard/events", matches: (ev) => clientEventMatchesFilter(ev, "events-all") },
      {
        id: "events-upcoming",
        label: "Upcoming",
        href: "/dashboard/events/upcoming",
        matches: (ev) => clientEventMatchesFilter(ev, "events-upcoming"),
      },
      {
        id: "events-in-planning",
        label: "In planning",
        href: "/dashboard/events/in-planning",
        matches: (ev) => clientEventMatchesFilter(ev, "events-in-planning"),
      },
      {
        id: "events-completed",
        label: "Completed",
        href: "/dashboard/events/completed",
        matches: (ev) => clientEventMatchesFilter(ev, "events-completed"),
      },
      {
        id: "events-cancelled",
        label: "Cancelled",
        href: "/dashboard/events/cancelled",
        matches: (ev) => clientEventMatchesFilter(ev, "events-cancelled"),
      },
    ];
    const activeEventFilterId =
      portalView === "dashboard-upcoming-events"
        ? "events-upcoming"
        : eventFilterOptions.some((option) => option.id === portalView)
          ? portalView as EventFilterId
          : "events-all";
    const activeEventFilter = eventFilterOptions.find((option) => option.id === activeEventFilterId) ?? eventFilterOptions[0];
    const visibleEvents = historyEvents.filter((ev) => {
      const query = eventSearch.trim().toLowerCase();
      if (!activeEventFilter.matches(ev)) return false;
      if (!query) return true;
      return `${ev.eventName} ${ev.eventDate} ${ev.status}`.toLowerCase().includes(query);
    });
  
    const todayKey = manilaDateKey();
    const searching = Boolean(eventSearch.trim());
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filters change the route, so they are links: they open in new tabs and keep the active state readable. */}
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Event status filters">
            {eventFilterOptions.map((filter) => {
              const active = filter.id === activeEventFilterId;
              return (
                <Link
                  key={filter.id}
                  href={filter.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                    active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                  <span className="tabular-nums text-muted-foreground">{historyEvents.filter(filter.matches).length}</span>
                </Link>
              );
            })}
          </nav>
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
            <Button asChild size="sm" className="shrink-0"><Link href="/dashboard/request"><Send className="size-4" /> New request</Link></Button>
          </div>
        </div>

        {visibleEvents.length ? (
          <ClientListSection id="client-events-list" title={activeEventFilter.label === "All" ? "All events" : activeEventFilter.label} count={visibleEvents.length}>
            {orderClientEvents(visibleEvents).map((ev) => {
              const nextAction = actionCenter?.items.find((item) => item.eventId === ev.id && item.priority !== "info");
              const past = isPastClientEvent(ev);
              return (
                <ClientListRow
                  key={ev.id}
                  icon={past ? CalendarCheck : CalendarDays}
                  tone={nextAction?.priority === "critical" ? "urgent" : nextAction ? "attention" : "neutral"}
                  title={ev.eventName}
                  meta={[formatPortalDate(ev.eventDate), ev.venue || "Venue to be confirmed", nextAction ? `Next: ${nextAction.label}` : formatStatusLabel(ev.status)].join(" · ")}
                  status={past ? formatStatusLabel(ev.status) : eventCountdown(ev.eventDate, todayKey) ?? "Date pending"}
                  action={past ? "View summary" : "Open event"}
                  href={dashboardHref(clientEventCardOpenRoute(ev), ev.id)}
                  onOpen={() => setSelectedEventId(ev.id)}
                />
              );
            })}
          </ClientListSection>
        ) : (
          <ClientListEmpty
            icon={CalendarDays}
            title={searching ? "No events match" : "No events here yet"}
            description={searching ? "Try a different name, date or status." : "Events appear here once PMCM accepts your inquiry and the conforme is signed."}
            action={searching ? undefined : <Button asChild size="sm"><Link href="/dashboard/request"><Send className="size-4" /> New event request</Link></Button>}
          />
        )}
      </div>
    );
}
