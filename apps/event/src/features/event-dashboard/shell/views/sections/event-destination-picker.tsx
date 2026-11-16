"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { CountdownPill, EventCard, EventCardGrid, EventCardHeader, EventCover, StageTrack, StepProgress } from "@prism/ui/event-cards";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, type PrismEvent, type PrismLifecycleStage } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@prism/ui/components/empty";
import { Input } from "@prism/ui/components/input";
import { SegmentedControl, type SegmentedOption } from "@/features/pmcm-kit";
import { useEventCoverUrl, type SummaryLabel } from "@/features/pmcm-overview";
import { eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";

/** How far along an event's work is, as steps done of all. */
export type PickerProgress = { done: number; total: number };

function RowDetail({ label }: { label: SummaryLabel | null }) {
  if (!label) return null;
  return <span className={label.urgent ? "mt-0.5 block text-xs font-medium text-attention" : "mt-0.5 block text-xs text-muted-foreground"}>{label.text}</span>;
}

type PickerEvent = Pick<PrismEvent, "id" | "eventName" | "clientName" | "eventDate" | "status" | "archived" | "actualEndedAt" | "clientPortalStatus" | "proposalClientStatus"> & Partial<Pick<PrismEvent, "eventType" | "coverObjectId">>;

const isFinished = (event: PickerEvent) => derivePrismLifecycleStage(event) === "closure_archive";

const PAGE_SIZE = 10;

/** Events still being run come first, soonest first; finished events follow, most recent first. */
export function orderPickerEvents<Event extends PickerEvent>(events: Event[]): Event[] {
  const byDate = (a: Event, b: Event) => (a.eventDate ?? "").localeCompare(b.eventDate ?? "");
  const active = events.filter((event) => !isFinished(event)).sort(byDate);
  const finished = events.filter(isFinished).sort((a, b) => byDate(b, a));
  return [...active, ...finished];
}

function matchesQuery(event: PickerEvent, query: string) {
  const text = `${event.eventName} ${event.clientName ?? ""}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

/** One event as a card, the same picture, date and stage as on Events, opening the section this page is about. */
function PickerCard({ event, actionLabel, tab, todayKey, onOpenEvent, detail, progress }: {
  event: PickerEvent;
  actionLabel: string;
  tab: DetailTab;
  todayKey: string;
  onOpenEvent: (eventId: string) => void;
  detail: SummaryLabel | null;
  progress: PickerProgress | null;
}) {
  const coverUrl = useEventCoverUrl(event.id, event.coverObjectId);
  const stage = derivePrismLifecycleStage(event);
  return (
    <EventCard cover={<EventCover eventType={event.eventType} imageUrl={coverUrl} />}>
      <EventCardHeader
        onCover
        date={event.eventDate ?? ""}
        title={event.eventName}
        titleLabel={`${actionLabel}: ${event.eventName}`}
        href={eventWorkspaceHref(event.id, tab)}
        onNavigate={() => onOpenEvent(event.id)}
        details={[event.clientName || "—", formatPortalDate(event.eventDate, "—")].join(" · ")}
        aside={event.eventDate && stage !== "closure_archive" ? <CountdownPill date={event.eventDate} todayKey={todayKey} /> : null}
        muted={stage === "closure_archive"}
      />
      <StageTrack stage={stage} />
      {progress ? <StepProgress done={progress.done} total={progress.total} /> : null}
      <RowDetail label={detail} />
    </EventCard>
  );
}

/**
 * Inline event chooser for global PMCM destinations (such as Files) that only work inside one event. Searchable and
 * stage-filterable, as event cards: choosing one opens that event's matching workspace section.
 */
export function EventDestinationPicker({
  events,
  description,
  actionLabel,
  tab,
  onOpenEvent,
  rowDetail,
  rowProgress,
}: {
  events: PickerEvent[];
  description: string;
  actionLabel: string;
  /** The workspace section each row opens. */
  tab: DetailTab;
  onOpenEvent: (eventId: string) => void;
  /** An extra line under each event, such as what it owes; absent or null shows nothing. */
  rowDetail?: (event: PickerEvent) => SummaryLabel | null;
  /** How far along each event's work is, drawn as steps on its card. */
  rowProgress?: (event: PickerEvent) => PickerProgress | null;
}) {
  const todayKey = manilaDateKey();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | PrismLifecycleStage>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const stageOptions = useMemo<SegmentedOption[]>(() => {
    const counts = new Map<PrismLifecycleStage, number>();
    for (const event of events) {
      const current = derivePrismLifecycleStage(event);
      counts.set(current, (counts.get(current) ?? 0) + 1);
    }
    return [
      { value: "all", label: "All", count: events.length },
      ...PRISM_LIFECYCLE_STAGES.filter((item) => counts.has(item)).map((item) => ({
        value: item,
        label: PRISM_LIFECYCLE_STAGE_LABELS[item],
        count: counts.get(item),
      })),
    ];
  }, [events]);

  const rows = orderPickerEvents(events).filter(
    (event) => matchesQuery(event, query) && (stage === "all" || derivePrismLifecycleStage(event) === stage),
  );
  const shown = rows.slice(0, visible);
  const hasEvents = events.length > 0;

  return (
    <section aria-labelledby="event-destination-picker-title" className="grid min-w-0 gap-4">
      <div className="grid gap-1">
        <h2 id="event-destination-picker-title" className="text-lg font-semibold text-foreground">Choose an event</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {hasEvents ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl label="Filter events by stage" options={stageOptions} value={stage} onChange={(value) => { setStage(value as "all" | PrismLifecycleStage); setVisible(PAGE_SIZE); }} />
          <label className="relative w-full max-w-72">
            <span className="sr-only">Find an event or client</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }}
              placeholder="Find an event or client"
              className="pl-9"
            />
          </label>
        </div>
      ) : null}

      {!hasEvents || rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{hasEvents ? "No event matches" : "No active events yet"}</EmptyTitle>
            <EmptyDescription>
              {hasEvents ? "Try another name, client or stage." : "Events appear here after an accepted inquiry has a signed conforme."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p role="status" className="text-xs text-muted-foreground">
            Showing {shown.length} of {rows.length} event{rows.length === 1 ? "" : "s"}
          </p>
          <EventCardGrid>
            {shown.map((event) => (
              <PickerCard key={event.id} event={event} actionLabel={actionLabel} tab={tab} todayKey={todayKey} onOpenEvent={onOpenEvent} detail={rowDetail?.(event) ?? null} progress={rowProgress?.(event) ?? null} />
            ))}
          </EventCardGrid>
          {rows.length > visible ? (
            <Button variant="outline" className="justify-self-center" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show more
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
