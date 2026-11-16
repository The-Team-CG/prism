"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronRight, LayoutGrid, ListTodo, UserRound, type LucideIcon } from "lucide-react";
import { derivePrismLifecycleStage, type PrismEvent, type PrismPmcmCalendarItem, type PrismPmcmClientActivity } from "@prism/types";
import { AgendaList, AttentionList, AttentionSummary, EventCover, StageTrack, eventCountdown, type AttentionLine } from "@prism/ui/event-cards";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismHero, PrismPanel } from "@prism/ui/page-blocks";
import { PMCM_CALENDAR_KINDS, clientActivityLine, toCalendarEntries } from "@/features/pmcm-overview";
import { RouteLink, cx } from "@/features/pmcm-kit";
import { eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";

function ClientActivity({ clientName, activity, todayKey }: { clientName: string; activity?: PrismPmcmClientActivity; todayKey: string }) {
  if (!activity) return null;
  const line = clientActivityLine(clientName, activity, todayKey);
  return (
    <p className={cx("flex items-center gap-1.5 text-sm", line.quiet ? "font-medium text-attention" : "text-ink-foreground/80")}>
      <UserRound aria-hidden className="size-4 shrink-0" />
      {line.text}
    </p>
  );
}

/** "7 / days to go", "Today / Event day"; a date that has passed has no countdown. */
function countdownFigure(eventDate: string, todayKey: string) {
  const countdown = eventCountdown(eventDate, todayKey);
  if (!countdown || countdown.days < 0) return undefined;
  if (countdown.days === 0) return { value: "Today", label: "Event day" };
  return { value: String(countdown.days), label: countdown.days === 1 ? "day to go" : "days to go" };
}

/**
 * The event as one lead block, the same shape the client sees on their overview: cover, name, date and venue, how
 * far away it is, its stage, and in the footer whether the client is keeping up plus the portal and guest-code facts.
 */
export function EventOverviewHero({ event, coverUrl, clientActivity, todayKey, facts }: {
  event: PrismEvent;
  coverUrl?: string;
  clientActivity?: PrismPmcmClientActivity;
  todayKey: string;
  facts: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <PrismHero
      label={event.clientName}
      title={event.eventName}
      meta={
        <>
          <p>{[formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed"].join(" · ")}</p>
          <div className="mt-4 max-w-sm"><StageTrack stage={derivePrismLifecycleStage(event)} onInk /></div>
        </>
      }
      figure={countdownFigure(event.eventDate, todayKey)}
      backdrop={<EventCover eventType={event.eventType} imageUrl={coverUrl} tag={false} className="h-full" />}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {clientActivity ? <ClientActivity clientName={event.clientName} activity={clientActivity} todayKey={todayKey} /> : <span />}
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-center gap-2 text-sm">
              <dt className="text-ink-foreground/70">{fact.label}</dt>
              <dd className="font-semibold text-ink-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </PrismHero>
  );
}

/** Lines shown before "Show all": enough to act on without the list pushing everything else off the page. */
const NEEDS_YOU_SHOWN = 6;

/**
 * What waits on PMCM for this event: a bar of how urgent it is, then the lines themselves, each saying how long it
 * has waited. The Inbox's own items plus what the workspace knows the Inbox does not (a requested venue visit, a
 * finished event owed its close-out).
 */
export function OverviewNeedsYou({ lines, loading }: { lines: AttentionLine[]; loading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const hidden = Math.max(0, lines.length - NEEDS_YOU_SHOWN);
  const shown = showAll ? lines : lines.slice(0, NEEDS_YOU_SHOWN);
  const footer = hidden > 0 ? (
    <button type="button" onClick={() => setShowAll((open) => !open)} className="text-xs font-medium text-primary hover:underline">
      {showAll ? "Show fewer" : `Show all ${lines.length}`}
    </button>
  ) : undefined;
  return (
    <PrismPanel id="overview-needs-you" title="Needs you" icon={ListTodo} aside={loading ? "Loading…" : `${lines.length} open`} footer={footer}>
      {lines.length > 0 ? (
        <div className="grid gap-4">
          <AttentionSummary lines={lines} />
          <AttentionList lines={shown} link={Link} />
        </div>
      ) : null}
      {lines.length === 0 && !loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 aria-hidden className="size-4 text-success" />Nothing is waiting on you for this event.</p>
      ) : null}
      {lines.length === 0 && loading ? <p className="text-sm text-muted-foreground">Checking what this event needs…</p> : null}
    </PrismPanel>
  );
}

/** The event's dated work for the next 30 days on calendar leaves: visits, quote deadlines, payments, supplier arrivals. */
export function OverviewComingUp({ eventId, items, todayKey }: { eventId: string; items?: PrismPmcmCalendarItem[]; todayKey: string }) {
  const entries = toCalendarEntries(items ?? [], todayKey);
  const agenda = entries.map((entry) => {
    const kind = entry.look?.label ?? PMCM_CALENDAR_KINDS[entry.kind as keyof typeof PMCM_CALENDAR_KINDS].label;
    return {
      id: entry.id,
      title: entry.title,
      detail: entry.startTime ? `${kind} · ${entry.startTime}` : kind,
      date: entry.date,
      href: entry.target === "overview" ? undefined : eventWorkspaceHref(eventId, entry.target),
    };
  });
  return (
    <PrismPanel id="overview-coming-up" title="Coming up" icon={CalendarClock} aside={<Link href="/dashboard/calendar" className="font-medium text-primary hover:underline">Calendar</Link>}>
      {items === undefined ? <p className="text-sm text-muted-foreground">Loading the next 30 days…</p> : null}
      {items?.length === 0 ? <p className="text-sm text-muted-foreground">Nothing dated in the next 30 days.</p> : null}
      {agenda.length > 0 ? <AgendaList items={agenda} link={Link} /> : null}
    </PrismPanel>
  );
}

export type AreaTone = "done" | "attention" | "idle";
export type AreaTile = { tab: DetailTab; title: string; icon: LucideIcon; status: string; tone: AreaTone };

const AREA_CHIP: Record<AreaTone, string> = {
  done: "bg-success-soft text-success",
  attention: "bg-attention-soft text-attention",
  idle: "bg-muted text-muted-foreground",
};

/** Every part of the event as a tile coloured by how it stands, each opening its tab. */
export function OverviewAreas({ eventId, areas, onOpenTab }: { eventId: string; areas: AreaTile[]; onOpenTab: (tab: DetailTab) => void }) {
  return (
    <PrismPanel id="overview-areas" title="Event areas" icon={LayoutGrid} bodyClassName="pt-2">
      <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => (
          <li key={area.tab}>
            <RouteLink
              href={eventWorkspaceHref(eventId, area.tab)}
              onNavigate={() => onOpenTab(area.tab)}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-raised"
            >
              <span aria-hidden className={cx("grid size-9 shrink-0 place-items-center rounded-lg", AREA_CHIP[area.tone])}>
                <area.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{area.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{area.status}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </RouteLink>
          </li>
        ))}
      </ul>
    </PrismPanel>
  );
}
