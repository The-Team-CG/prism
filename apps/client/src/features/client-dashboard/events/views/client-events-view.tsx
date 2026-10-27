"use client";

import { CalendarDays, Send } from "lucide-react";
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
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Event status filters">
            {eventFilterOptions.map((filter) => {
              const active = filter.id === activeEventFilterId;
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => router.push(filter.href)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                  <span className={cn("text-xs", active ? "text-primary" : "text-muted-foreground")}>
              {historyEvents.filter(filter.matches).length}
                  </span>
                </button>
              );
            })}
          </div>
          <Input
            value={eventSearch}
            onChange={(ev) => setEventSearch(ev.target.value)}
            placeholder="Search by name, date, or status..."
            className="w-full rounded-lg sm:ml-auto sm:max-w-sm"
          />
        </div>
  
        {visibleEvents.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {visibleEvents.map((ev) => {
              const nextAction = actionCenter?.items.find((item) => item.eventId === ev.id && item.priority !== "info");
              return (
                <div key={ev.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground">{ev.eventName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{ev.eventDate} · {ev.venue || "Venue to be confirmed"} · {ev.status.replaceAll("_", " ")}</p>
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
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
              <CalendarDays className="size-6 text-muted-foreground" />
            </span>
            <h3 className="mt-4 text-base font-black text-foreground">No events found</h3>
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
