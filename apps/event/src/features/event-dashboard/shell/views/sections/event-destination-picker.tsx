"use client";

import { ChevronRight } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import { RouteLink } from "@/features/pmcm-kit";
import { eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";

/**
 * Inline event chooser for global PMCM destinations (Finance, Files, Messages) that only work inside one
 * event. Choosing a row opens that event's matching workspace section directly.
 */
export function EventDestinationPicker({
  events,
  description,
  actionLabel,
  tab,
  onOpenEvent,
}: {
  events: Pick<PrismEvent, "id" | "eventName" | "clientName" | "eventDate">[];
  description: string;
  actionLabel: string;
  /** The workspace section each row opens. */
  tab: DetailTab;
  onOpenEvent: (eventId: string) => void;
}) {
  const sorted = [...events].sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
  return (
    <section aria-labelledby="event-destination-picker-title" className="min-w-0 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 id="event-destination-picker-title" className="text-lg font-semibold text-foreground">Choose an event</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {sorted.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">No active events yet. Events appear here after an accepted inquiry has a signed conforme.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((event) => (
            <li key={event.id}>
              <RouteLink
                href={eventWorkspaceHref(event.id, tab)}
                onNavigate={() => onOpenEvent(event.id)}
                title={event.eventName}
                aria-label={`${actionLabel}: ${event.eventName}`}
                className="flex min-h-11 w-full min-w-0 items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold text-foreground">{event.eventName}</span>
                  <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                    {event.clientName || "—"} · <span className="tabular-nums">{formatPortalDate(event.eventDate, "—")}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 text-sm font-medium text-primary sm:inline">{actionLabel}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </RouteLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
