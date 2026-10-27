"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
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
        <h2 className="text-sm font-semibold text-foreground">Choose an event to see its {purpose}</h2>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Events">
        {events.map((event) => (
          <Link key={event.id} href={dashboardHref(destination, event.id)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">
            {event.eventName}
          </Link>
        ))}
      </div>
    </section>
  );
}
