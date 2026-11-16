"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronRight, Search } from "lucide-react";
import { useListFilter } from "@/features/pmcm-kit";
import { derivePrismLifecycleStage, type PrismEvent, type PrismPmcmEventAttention } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { AttentionList, CountdownPill, EventCard, EventCardFooter, EventCardGrid, EventCardHeader, EventCover, MoneyBar, StageTrack } from "@prism/ui/event-cards";
import { useEventCoverUrl, type EventShortcutCounts } from "@/features/pmcm-overview";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";
import { attentionLines, groupEventCards, needsPmcm } from "../../model/event-card-groups";
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

/**
 * Every confirmed event as a card: what waits on PMCM first, with the Inbox's own items, then what is coming up,
 * then finished events. Each card shows the date, how far away it is, its stage, what is waiting and the money.
 */
export function EventRegister({ events, data = {}, onOpenEvent }: { events: PrismEvent[]; data?: EventRegisterData; onOpenEvent: (id: string) => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useListFilter("q");
  const [showAllDone, setShowAllDone] = useState(false);
  const todayKey = manilaDateKey();
  const groups = groupEventCards(events.filter((event) => matches(event, query)), data.attention);
  const total = groups.needsYou.length + groups.comingUp.length + groups.done.length;
  const card = (event: PrismEvent, compact = false) => <PmcmEventCard key={event.id} event={event} data={data} todayKey={todayKey} onOpenEvent={onOpenEvent} compact={compact} />;
  const done = showAllDone ? groups.done : groups.done.slice(0, DONE_PREVIEW);
  return (
    <div className="grid gap-6">
      <EventRegisterToolbar activeId={pathname} query={query} onQuery={setQuery} counts={data.viewCounts} />
      <p role="status" className="sr-only">{total} event{total === 1 ? "" : "s"} in this view{query ? ` matching “${query}”` : ""}</p>
      {total === 0 ? <NoEvents query={query} /> : null}
      <CardSection id="events-needs-you" title="Needs you" count={groups.needsYou.length} description="Each card lists what the Inbox has waiting on that event. Open a line to do it.">
        <EventCardGrid>{groups.needsYou.map((event) => card(event))}</EventCardGrid>
      </CardSection>
      <CardSection id="events-coming-up" title={data.attention ? "Coming up" : "Events"} count={groups.comingUp.length}>
        <EventCardGrid>{groups.comingUp.map((event) => card(event))}</EventCardGrid>
      </CardSection>
      <CardSection id="events-done" title="Done" count={groups.done.length}>
        <EventCardGrid>{done.map((event) => card(event, true))}</EventCardGrid>
        {groups.done.length > done.length ? (
          <button type="button" onClick={() => setShowAllDone(true)} className="justify-self-start rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised">
            Show all {groups.done.length} finished events
          </button>
        ) : null}
      </CardSection>
    </div>
  );
}
