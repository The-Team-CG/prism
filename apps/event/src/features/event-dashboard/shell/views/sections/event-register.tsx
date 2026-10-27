"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { cn } from "@/app/components/ui/utils";

const VIEWS = [
  { href: "/dashboard/events", label: "All events" },
  { href: "/dashboard/events/upcoming", label: "Upcoming" },
  { href: "/dashboard/events/ongoing", label: "In progress" },
  { href: "/dashboard/events/completed", label: "Completed" },
  { href: "/dashboard/events/cancelled", label: "Cancelled" },
] as const;

function matches(event: PrismEvent, query: string) {
  const text = `${event.eventName} ${event.clientName} ${event.venue ?? ""}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

/** Every confirmed event as one searchable register; opening a row enters that event's workspace. */
export function EventRegister({ events, onOpenEvent }: { events: PrismEvent[]; onOpenEvent: (id: string) => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const rows = [...events].filter((event) => matches(event, query)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Event views" className="flex flex-wrap gap-1">
          {VIEWS.map((view) => {
            const active = pathname === view.href;
            return (
              <Link
                key={view.href}
                href={view.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view.label}
              </Link>
            );
          })}
        </nav>
        <label className="relative w-full max-w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an event, client or venue"
            aria-label="Find an event, client or venue"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarDays}
              title={query ? "No event matches" : "No events in this view"}
              description={query ? "Try a client, venue or part of the event name." : "Accepted inquiries become events once the conforme is signed."}
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Event</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Date</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Venue</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((event) => (
                <tr key={event.id} className="hover:bg-surface-raised">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{event.eventName}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.clientName}
                      <span className="sm:hidden"> · {event.eventDate}</span>
                    </p>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums text-foreground sm:table-cell">{event.eventDate}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{event.venue || "Not recorded"}</td>
                  <td className="px-4 py-3"><StatusBadge status={event.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => onOpenEvent(event.id)} className="whitespace-nowrap text-sm font-semibold text-primary hover:text-primary-strong">
                      Open<span className="sr-only"> {event.eventName}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
