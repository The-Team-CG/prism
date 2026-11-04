"use client";

import { ChevronRight } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, type PrismEvent } from "@prism/types";
import { RouteLink } from "@/features/pmcm-kit";
import type { SummaryLabel } from "@/features/pmcm-overview";
import { eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";

function RowDetail({ label }: { label: SummaryLabel | null }) {
  if (!label) return null;
  return <span className={label.urgent ? "mt-0.5 block text-xs font-medium text-attention" : "mt-0.5 block text-xs text-muted-foreground"}>{label.text}</span>;
}

type PickerEvent = Pick<PrismEvent, "id" | "eventName" | "clientName" | "eventDate" | "status" | "archived" | "actualEndedAt" | "clientPortalStatus" | "proposalClientStatus">;

const isFinished = (event: PickerEvent) => derivePrismLifecycleStage(event) === "closure_archive";

/** Events still being run come first, soonest first; finished events follow, most recent first. */
export function orderPickerEvents<Event extends PickerEvent>(events: Event[]): Event[] {
  const byDate = (a: Event, b: Event) => (a.eventDate ?? "").localeCompare(b.eventDate ?? "");
  const active = events.filter((event) => !isFinished(event)).sort(byDate);
  const finished = events.filter(isFinished).sort((a, b) => byDate(b, a));
  return [...active, ...finished];
}

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
  rowDetail,
}: {
  events: PickerEvent[];
  description: string;
  actionLabel: string;
  /** The workspace section each row opens. */
  tab: DetailTab;
  onOpenEvent: (eventId: string) => void;
  /** An extra line under each event, such as what it owes; absent or null shows nothing. */
  rowDetail?: (event: PickerEvent) => SummaryLabel | null;
}) {
  const sorted = orderPickerEvents(events);
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
                    {event.clientName || "—"} · <span className="tabular-nums">{formatPortalDate(event.eventDate, "—")}</span> · {PRISM_LIFECYCLE_STAGE_LABELS[derivePrismLifecycleStage(event)]}
                  </span>
                  <RowDetail label={rowDetail?.(event) ?? null} />
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
