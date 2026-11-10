"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, type PrismEvent } from "@prism/types";
import { daysUntil, formatPortalDate, manilaCalendarKey } from "@prism/ui/format-date";
import { Progress } from "@prism/ui/components/progress";
import { PrismHero } from "@prism/ui/page-blocks";

/** Where an event stands in its six stages, as a number for the progress bar and a label beside it. */
export function clientEventStage(event: PrismEvent) {
  const index = Math.max(0, PRISM_LIFECYCLE_STAGES.indexOf(derivePrismLifecycleStage(event)));
  const stage = PRISM_LIFECYCLE_STAGES[index];
  return {
    number: index + 1,
    total: PRISM_LIFECYCLE_STAGES.length,
    label: stage ? PRISM_LIFECYCLE_STAGE_LABELS[stage] : "",
    percent: Math.round(((index + 0.5) / PRISM_LIFECYCLE_STAGES.length) * 100),
  };
}

/** Whole days from today (a Manila date key) to the event; null when the event has no date. */
export function clientEventDaysToGo(event: Pick<PrismEvent, "eventDate">, todayKey: string): number | null {
  return event.eventDate ? daysUntil(manilaCalendarKey(event.eventDate), todayKey) : null;
}

/** "12 days to go", "1 day to go", "Today". A date that has passed has no countdown. */
function countdownFigure(daysToGo: number | null): { value: string; label: string } | undefined {
  if (daysToGo === null || daysToGo < 0) return undefined;
  if (daysToGo === 0) return { value: "Today", label: "Event day" };
  return { value: String(daysToGo), label: daysToGo === 1 ? "day to go" : "days to go" };
}

/**
 * The lead block for one event, shared by the client home and the event overview: its name, date and
 * venue, how far away it is, where it stands in the six stages, and (as `children`) the one step it
 * needs from the client.
 */
export function ClientEventHero({
  event,
  daysToGo,
  label,
  eventHref,
  onOpen,
  children,
}: {
  event: PrismEvent;
  daysToGo: number | null;
  label: string;
  /** When set, the event name links to the event. Left out on the event's own pages. */
  eventHref?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const stage = clientEventStage(event);
  return (
    <PrismHero
      label={label}
      title={eventHref ? <Link href={eventHref} onClick={onOpen} className="outline-none hover:underline focus-visible:underline">{event.eventName}</Link> : event.eventName}
      meta={
        <>
          <p>{[formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed"].join(" · ")}</p>
          <div className="mt-4 max-w-sm">
            <Progress value={stage.percent} className="bg-ink-foreground/15" aria-label={`Stage ${stage.number} of ${stage.total}`} />
            <p className="mt-2 text-xs">Stage {stage.number} of {stage.total} · <span className="font-medium text-ink-foreground">{stage.label}</span></p>
          </div>
        </>
      }
      figure={countdownFigure(daysToGo)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">{children}</div>
    </PrismHero>
  );
}

/** The hero's footer text: the next step, or a calm line when nothing is needed. */
export function ClientEventHeroStep({ label = "Your next step", title, description }: { label?: string; title: string; description?: string }) {
  return (
    <div className="min-w-0 flex-1 basis-64">
      <p className="text-sm text-ink-foreground/70">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{title}</p>
      {description ? <p className="mt-0.5 text-sm text-ink-foreground/70">{description}</p> : null}
    </div>
  );
}
