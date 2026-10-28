"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { useClientWorkspace } from "../../client-workspace-context";
import { dashboardHref } from "../../model/client-dashboard-navigation";
import type { ClientDashboardRoute } from "../../model/client-dashboard-types";
import { formatStatusLabel } from "../../model/client-dashboard-view-rules";

type EventDestination = Extract<ClientDashboardRoute, "approvals" | "billing" | "documents" | "messages">;

/**
 * Account-level pages belong to an event. One event opens directly (the link stays as a fallback);
 * several events get a compact list that lands on the same section of the chosen event.
 */
export function ClientAccountEventPicker({ purpose, destination }: { purpose: string; destination: EventDestination }) {
  const { events, router } = useClientWorkspace();
  const onlyEventHref = events.length === 1 ? dashboardHref(destination, events[0].id) : null;

  useEffect(() => {
    if (onlyEventHref) router.replace(onlyEventHref);
  }, [onlyEventHref, router]);

  if (events.length === 0) return null;
  if (onlyEventHref) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Opening {purpose} for{" "}
        <Link href={onlyEventHref} className="font-medium text-primary hover:text-primary/80">{events[0].eventName}</Link>…
      </p>
    );
  }
  return (
    <section aria-labelledby="client-account-event-picker" className="rounded-lg border border-border bg-card">
      <h2 id="client-account-event-picker" className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
        Choose an event to see its {purpose}
      </h2>
      <ul className="divide-y divide-border">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={dashboardHref(destination, event.id)}
              className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium text-foreground">{event.eventName}</span>
                <span className="block text-muted-foreground">
                  {formatPortalDate(event.eventDate)} · {formatStatusLabel(event.status)}{event.venue ? ` · ${event.venue}` : ""}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
