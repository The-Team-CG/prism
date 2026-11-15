"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, UserRound } from "lucide-react";
import { derivePrismLifecycleStage, type PrismEvent, type PrismPmcmCalendarItem, type PrismPmcmClientActivity } from "@prism/types";
import { AttentionList, CountdownPill, DateTile, EventCover, StageTrack, type AttentionLine } from "@prism/ui/event-cards";
import { formatPortalDate } from "@prism/ui/format-date";
import { PMCM_CALENDAR_KINDS, clientActivityLine, toCalendarEntries, type EventShortcutCounts } from "@/features/pmcm-overview";
import { cx } from "@/features/pmcm-kit";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";
import { EventShortcuts } from "./event-shortcuts";

function ClientActivity({ clientName, activity, todayKey }: { clientName: string; activity?: PrismPmcmClientActivity; todayKey: string }) {
  if (!activity) return null;
  const line = clientActivityLine(clientName, activity, todayKey);
  return (
    <p className={cx("flex items-center gap-1.5 text-xs", line.quiet ? "font-medium text-attention" : "text-muted-foreground")}>
      <UserRound aria-hidden className="size-3.5 shrink-0" />
      {line.text}
    </p>
  );
}

/**
 * The event at a glance, as its card shows it: cover, date, how far away, stage, the Billing/Files/Messages
 * shortcuts, whether the client is keeping up, and the portal and guest-code facts PMCM reaches for.
 */
export function EventOverviewHeader({ event, coverUrl, shortcuts, clientActivity, todayKey, facts }: {
  event: PrismEvent;
  coverUrl?: string;
  shortcuts: EventShortcutCounts;
  clientActivity?: PrismPmcmClientActivity;
  todayKey: string;
  facts: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <section aria-label="Event at a glance" className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <EventCover eventType={event.eventType} imageUrl={coverUrl} className="h-28 sm:h-36" />
      <div className="grid gap-4 px-4 pb-4 sm:px-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 pt-3">
          <DateTile date={event.eventDate} raised />
          <div className="min-w-0">
            <h2 className="font-semibold leading-snug text-foreground">{event.eventName}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{[event.clientName, event.venue].filter(Boolean).join(" · ")}</p>
          </div>
          <CountdownPill date={event.eventDate} todayKey={todayKey} />
        </div>
        <StageTrack stage={derivePrismLifecycleStage(event)} />
        <ClientActivity clientName={event.clientName} activity={clientActivity} todayKey={todayKey} />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-3">
          <EventShortcuts eventId={event.id} counts={shortcuts} />
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-center gap-2 text-xs">
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="font-semibold text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function OverviewPanel({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 id={id} className="font-semibold text-foreground">{title}</h2>
        {aside}
      </div>
      <div className="px-4 py-3.5 sm:px-5">{children}</div>
    </section>
  );
}

/**
 * What waits on PMCM for this event: the Inbox's own items, each saying how long it has waited, plus anything the
 * workspace knows the Inbox does not (a venue visit the client asked for, a finished event owed its close-out).
 */
export function OverviewNeedsYou({ lines, loading }: { lines: AttentionLine[]; loading: boolean }) {
  const aside = <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${lines.length} open`}</span>;
  return (
    <OverviewPanel id="overview-needs-you" title="Needs you" aside={aside}>
      {lines.length > 0 ? <AttentionList lines={lines} link={Link} /> : null}
      {lines.length === 0 && !loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 aria-hidden className="size-4 text-success" />Nothing is waiting on you for this event.</p>
      ) : null}
      {lines.length === 0 && loading ? <p className="text-sm text-muted-foreground">Checking what this event needs…</p> : null}
    </OverviewPanel>
  );
}

function comingUpTime(date: string, startTime?: string) {
  return startTime ? `${formatPortalDate(date)} · ${startTime}` : formatPortalDate(date);
}

/** The event's dated work for the next 30 days: visits, quote deadlines, payments due, supplier arrivals. */
export function OverviewComingUp({ eventId, items, todayKey }: { eventId: string; items?: PrismPmcmCalendarItem[]; todayKey: string }) {
  const entries = toCalendarEntries(items ?? [], todayKey);
  return (
    <OverviewPanel id="overview-coming-up" title="Coming up" aside={<Link href="/dashboard/calendar" className="text-xs font-medium text-primary hover:underline">Calendar</Link>}>
      {items === undefined ? <p className="text-sm text-muted-foreground">Loading the next 30 days…</p> : null}
      {items?.length === 0 ? <p className="text-sm text-muted-foreground">Nothing dated in the next 30 days.</p> : null}
      {entries.length > 0 ? (
        <ul className="grid gap-2.5">
          {entries.map((entry) => {
            const label = entry.look?.label ?? PMCM_CALENDAR_KINDS[entry.kind as keyof typeof PMCM_CALENDAR_KINDS].label;
            const body = (
              <>
                <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{entry.title}</span>
                  <span className="block text-xs text-muted-foreground">{label} · {comingUpTime(entry.date, entry.startTime)}</span>
                </span>
              </>
            );
            return (
              <li key={entry.id}>
                {entry.target === "overview"
                  ? <div className="flex items-start gap-2.5">{body}</div>
                  : <Link href={eventWorkspaceHref(eventId, entry.target)} className="flex items-start gap-2.5 rounded-md hover:bg-surface-raised">{body}</Link>}
              </li>
            );
          })}
        </ul>
      ) : null}
    </OverviewPanel>
  );
}
