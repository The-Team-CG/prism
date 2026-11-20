"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronRight, Search } from "lucide-react";
import { cx, useListFilter } from "@/features/pmcm-kit";
import { PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, type PrismEvent, type PrismLifecycleStage, type PrismPmcmEventAttention } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { AttentionList, CountdownPill, EventCard, EventCardFooter, EventCardGrid, EventCardHeader, EventCover, MoneyBar, StageTrack, dateTileParts } from "@prism/ui/event-cards";
import { useEventCoverUrl, type EventShortcutCounts } from "@/features/pmcm-overview";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";
import { EVENT_CARD_WINDOW_DAYS, attentionLines, needsPmcm, planEventRegister, type EventRegisterPlan } from "../../model/event-card-groups";
import { WorkspaceRouteTabs } from "./workspace-sub-tabs";
import { EventShortcuts } from "./event-shortcuts";

export const EVENT_REGISTER_VIEWS = [
  { href: "/dashboard/events", label: "All events" },
  { href: "/dashboard/events/upcoming", label: "Upcoming" },
  { href: "/dashboard/events/ongoing", label: "In progress" },
  { href: "/dashboard/events/completed", label: "Completed" },
  { href: "/dashboard/events/cancelled", label: "Cancelled" },
  { href: "/dashboard/events?part=archive", label: "Archive" },
] as const;

/** The finished events shown before "Show all": the rest are one click away. */
const DONE_PREVIEW = 6;

export type EventMoney = { billed: number; paid: number; checking: number };

export type EventRegisterData = {
  /** The Inbox's items per event; undefined until that read arrives. */
  attention?: Map<string, PrismPmcmEventAttention>;
  money?: Map<string, EventMoney>;
  /** Counts for each card's Billing, Files and Messages shortcuts. */
  shortcuts?: Map<string, EventShortcutCounts>;
  /** How many events each view tab holds, keyed by the tab's address. */
  viewCounts?: Record<string, number>;
};

function matches(event: PrismEvent, query: string) {
  const text = `${event.eventName} ${event.clientName} ${event.venue ?? ""}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

/** The one toolbar for every events view: which events, the archive, and search. */
export function EventRegisterToolbar({ activeId, query, onQuery, counts }: { activeId: string; query?: string; onQuery?: (value: string) => void; counts?: Record<string, number> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <WorkspaceRouteTabs label="Event views" tabs={EVENT_REGISTER_VIEWS.map((view) => ({ id: view.href, label: view.label, href: view.href, count: counts?.[view.href] }))} activeId={activeId} />
      {onQuery ? (
        <label className="relative w-full sm:max-w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query ?? ""}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Find an event, client or venue"
            aria-label="Find an event, client or venue"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
      ) : null}
    </div>
  );
}

function ClearChip() {
  return <span className="inline-flex items-center gap-1 self-start justify-self-start rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success"><CheckCircle2 aria-hidden className="size-3" />Nothing waiting on you</span>;
}

/** A live event's middle: where it stands, what waits on PMCM (or that nothing does), and the shortcuts. */
function CardBody({ event, data, todayKey }: { event: PrismEvent; data: EventRegisterData; todayKey: string }) {
  const attention = data.attention?.get(event.id);
  const waiting = needsPmcm(attention);
  return (
    <>
      <StageTrack stage={derivePrismLifecycleStage(event)} />
      {attention && waiting ? <AttentionList lines={attentionLines(attention.top, todayKey)} more={attention.total - attention.top.length} link={Link} /> : null}
      {data.attention !== undefined && !waiting ? <ClearChip /> : null}
      <EventShortcuts eventId={event.id} counts={data.shortcuts?.get(event.id) ?? {}} />
    </>
  );
}

function PmcmEventCard({ event, data, todayKey, onOpenEvent, compact = false }: { event: PrismEvent; data: EventRegisterData; todayKey: string; onOpenEvent: (id: string) => void; compact?: boolean }) {
  const attention = data.attention?.get(event.id);
  const money = data.money?.get(event.id);
  const coverUrl = useEventCoverUrl(event.id, event.coverObjectId);
  return (
    <EventCard urgent={needsPmcm(attention)} compact={compact} cover={<EventCover eventType={event.eventType} imageUrl={coverUrl} small={compact} />}>
      <EventCardHeader
        onCover
        date={event.eventDate}
        title={event.eventName}
        href={eventWorkspaceHref(event.id)}
        onNavigate={() => onOpenEvent(event.id)}
        details={[event.clientName, event.venue].filter(Boolean).join(" · ")}
        aside={<CountdownPill date={event.eventDate} todayKey={todayKey} />}
        muted={compact}
      />
      {compact ? null : <CardBody event={event} data={data} todayKey={todayKey} />}
      <EventCardFooter>
        {money ? <MoneyBar billed={money.billed} paid={money.paid} checking={money.checking} /> : <span className="flex-1" />}
        {compact ? null : <span aria-hidden className="ml-auto inline-flex items-center font-semibold text-primary">Open<ChevronRight className="size-4" /></span>}
      </EventCardFooter>
    </EventCard>
  );
}

function CardSection({ id, title, description, count, children }: { id: string; title: string; description?: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <div>
        <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-foreground">{title}<span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span></h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function NoEvents({ query }: { query: string }) {
  return (
    <Empty className="rounded-xl border border-border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
        <EmptyTitle>{query ? "No event matches" : "No events in this view"}</EmptyTitle>
        <EmptyDescription>{query ? "Try a client, venue or part of the event name." : "Accepted inquiries become events once the conforme is signed."}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** How many active events sit in each stage; picking one narrows the cards and rows to it. */
function StageFilter({ stages, active, onPick }: { stages: EventRegisterPlan["stages"]; active: PrismLifecycleStage | null; onPick: (stage: PrismLifecycleStage | null) => void }) {
  if (stages.length === 0) return null;
  return (
    <div role="group" aria-label="Filter by stage" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stages.map(({ stage, count }) => {
        const on = active === stage;
        return (
          <button
            key={stage}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : stage)}
            className={cx(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              on ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-surface-raised",
            )}
          >
            <span className="block text-xs text-muted-foreground">{PRISM_LIFECYCLE_STAGE_LABELS[stage]}</span>
            <span className="block text-xl font-semibold tabular-nums text-foreground">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

const ROW_GRID = "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[3.5rem_minmax(0,1.4fr)_8rem_minmax(0,1.3fr)_minmax(0,1fr)] sm:items-center";

/** One event as a row: date, name and client, stage, the first thing waiting on PMCM, and the money. */
function EventRow({ event, data, todayKey, onOpenEvent }: { event: PrismEvent; data: EventRegisterData; todayKey: string; onOpenEvent: (id: string) => void }) {
  const attention = data.attention?.get(event.id);
  const [first] = attention && needsPmcm(attention) ? attentionLines(attention.top, todayKey) : [];
  const more = attention && first ? attention.total - 1 : 0;
  const money = data.money?.get(event.id);
  const tile = dateTileParts(event.eventDate);
  return (
    <li className={cx("relative transition-colors hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised", ROW_GRID)}>
      <span className="row-span-2 text-center sm:row-span-1">
        <span className="block text-[11px] font-medium text-primary">{tile?.month ?? "TBC"}</span>
        <span className="block text-lg font-semibold leading-none tabular-nums text-foreground">{tile?.day ?? "–"}</span>
      </span>
      <span className="min-w-0">
        <Link href={eventWorkspaceHref(event.id)} onClick={() => onOpenEvent(event.id)} className="block truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">
          {event.eventName}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">{[event.clientName, event.venue].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-sm">{PRISM_LIFECYCLE_STAGE_LABELS[derivePrismLifecycleStage(event)]}</span>
      <span className="col-start-2 min-w-0 text-xs sm:col-start-auto sm:text-sm">
        {first ? (
          <span className={cx("block truncate", first.severity === "critical" ? "font-medium text-danger" : "text-attention")}>
            {first.text}{more > 0 ? <span className="font-normal text-muted-foreground"> +{more}</span> : null}
          </span>
        ) : data.attention ? <span className="text-muted-foreground">Nothing waiting</span> : null}
      </span>
      <span className="col-start-2 min-w-0 sm:col-start-auto">{money ? <MoneyBar billed={money.billed} paid={money.paid} checking={money.checking} /> : null}</span>
    </li>
  );
}

/**
 * Every confirmed event, in the order PMCM works them: a stage filter, full cards only for what is on in the next
 * two weeks, one row each for everything else still being worked (an event whose date has passed first, since it is
 * owed a close-out), then finished events.
 */
export function EventRegister({ events, data = {}, onOpenEvent }: { events: PrismEvent[]; data?: EventRegisterData; onOpenEvent: (id: string) => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useListFilter("q");
  const [stage, setStage] = useState<PrismLifecycleStage | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const todayKey = manilaDateKey();
  const plan = planEventRegister(events.filter((event) => matches(event, query)), todayKey);
  const inStage = (event: PrismEvent) => !stage || derivePrismLifecycleStage(event) === stage;
  const near = plan.near.filter(inStage);
  const later = plan.later.filter(inStage);
  const total = plan.near.length + plan.later.length + plan.done.length;
  const card = (event: PrismEvent, compact = false) => <PmcmEventCard key={event.id} event={event} data={data} todayKey={todayKey} onOpenEvent={onOpenEvent} compact={compact} />;
  const done = showAllDone ? plan.done : plan.done.slice(0, DONE_PREVIEW);
  return (
    <div className="grid gap-6">
      <EventRegisterToolbar activeId={pathname} query={query} onQuery={setQuery} counts={data.viewCounts} />
      <p role="status" className="sr-only">{total} event{total === 1 ? "" : "s"} in this view{query ? ` matching “${query}”` : ""}</p>
      {total === 0 ? <NoEvents query={query} /> : null}
      <StageFilter stages={plan.stages} active={stage} onPick={setStage} />
      <CardSection id="events-near" title={`Next ${EVENT_CARD_WINDOW_DAYS} days`} count={near.length}>
        <EventCardGrid>{near.map((event) => card(event))}</EventCardGrid>
      </CardSection>
      <CardSection id="events-later" title={near.length ? "Later" : "Events"} count={later.length} description={later.some((event) => event.eventDate.slice(0, 10) < todayKey) ? "Events whose date has passed come first: each is owed its close-out." : undefined}>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {later.map((event) => <EventRow key={event.id} event={event} data={data} todayKey={todayKey} onOpenEvent={onOpenEvent} />)}
        </ul>
      </CardSection>
      {stage ? null : (
        <CardSection id="events-done" title="Done" count={plan.done.length}>
          <EventCardGrid>{done.map((event) => card(event, true))}</EventCardGrid>
          {plan.done.length > done.length ? (
            <button type="button" onClick={() => setShowAllDone(true)} className="justify-self-start rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised">
              Show all {plan.done.length} finished events
            </button>
          ) : null}
        </CardSection>
      )}
    </div>
  );
}
