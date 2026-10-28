"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
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

export function ClientEventsView() {
  const {
    router,
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
  
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{historyEvents.length} event{historyEvents.length === 1 ? "" : "s"}</p>
          <Button className="rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
            <Send className="size-4" /> New request
          </Button>
        </div>
  
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
          <label htmlFor="client-event-search" className="sr-only">Search events</label>
          <Input
            id="client-event-search"
            type="search"
            value={eventSearch}
            onChange={(ev) => setEventSearch(ev.target.value)}
            placeholder="Search by name, date or status"
            className="h-10 w-full rounded-md sm:ml-auto sm:max-w-sm"
          />
        </div>
  
        {visibleEvents.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {visibleEvents.map((ev) => {
              const nextAction = actionCenter?.items.find((item) => item.eventId === ev.id && item.priority !== "info");
              return (
                <div key={ev.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold text-foreground">{ev.eventName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{formatPortalDate(ev.eventDate)} · {ev.venue || "Venue to be confirmed"} · {formatStatusLabel(ev.status)}</p>
                    {nextAction ? <p className="mt-1 text-sm text-foreground">{nextAction.label}</p> : null}
                  </div>
                  <Button variant="outline" onClick={() => {
                    setSelectedEventId(ev.id);
                    router.push(dashboardHref(clientEventCardOpenRoute(ev), ev.id));
                  }}>Open event</Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-foreground">No events found</h3>
            <p className="mt-2 max-w-sm mx-auto text-sm text-muted-foreground">
              {eventSearch ? "Try a different search term." : "Submit a new event request to get started."}
            </p>
            {!eventSearch && (
              <Button className="mt-5 rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
                <Send className="size-4" /> New event request
              </Button>
            )}
          </div>
        )}
      </div>
    );
}
