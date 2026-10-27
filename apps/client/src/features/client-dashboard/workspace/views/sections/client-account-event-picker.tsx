"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { useClientWorkspace } from "../../client-workspace-context";
import { dashboardHref } from "../../model/client-dashboard-navigation";
import type { ClientDashboardRoute } from "../../model/client-dashboard-types";

type EventDestination = Extract<ClientDashboardRoute, "approvals" | "billing" | "documents" | "messages">;

export function ClientAccountEventPicker({ purpose, destination }: { purpose: string; destination: EventDestination }) {
  const { events } = useClientWorkspace();
  if (events.length === 0) return null;
  return (
    <section aria-label="Event" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">{events.length === 1 ? `Open your event’s ${purpose}` : `Choose an event to see its ${purpose}`}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{events.length === 1 ? "This page belongs to your event below." : "Use the event date and venue to choose the right workspace."}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Events">
        {events.map((event) => (
          <Link key={event.id} href={dashboardHref(destination, event.id)} className="rounded-lg bg-muted/40 px-4 py-4 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">
            <span className="block font-semibold">{event.eventName}</span>
            <span className="mt-1 block text-muted-foreground">{formatPortalDate(event.eventDate)} · {event.status.replaceAll("_", " ")}</span>
            {event.venue ? <span className="mt-1 block text-muted-foreground">{event.venue}</span> : null}
            <span className="mt-3 block font-semibold text-primary">View {purpose}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
