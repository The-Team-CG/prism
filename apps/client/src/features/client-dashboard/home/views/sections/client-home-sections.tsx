"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Mail, MessageSquareText, Phone, Send } from "lucide-react";
import { formatPortalDate, formatPortalDateTime, manilaDateKey } from "@prism/ui/format-date";
import { EventCover, NextStepHero, dueFigure } from "@prism/ui/event-cards";
import type { PrismClientActionCenter, PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Progress } from "@prism/ui/components/progress";
import { PrismEmptyLine, PrismSection, PrismSectionGroupLabel } from "@prism/ui/page-blocks";
import { ClientEventHero, clientEventStage } from "../../../shared/client-event-hero";
import { useEventCoverUrl } from "../../../events/view-models/use-event-cover-url";
import type { ClientDashboardAction } from "../../../workspace/shared";
import { ClientActionLists } from "../../../shared/client-action-lists";
import { eventCountdown, isPastClientEvent, orderClientEvents, type ClientHomeLead } from "../../model/client-home-summary";

/** Days to the event, for a step with no due date of its own. */
function eventCountdownFigure(daysToGo: number | null) {
  if (daysToGo === null || daysToGo < 0) return undefined;
  if (daysToGo === 0) return { value: "Today", label: "Event day" };
  return { value: String(daysToGo), label: daysToGo === 1 ? "day to go" : "days to go" };
}

/**
 * The home's lead: the event that is coming up, how far away it is, where it stands, and the one
 * step it needs from the client.
 */
export function ClientHomeHero({
  lead,
  eventHref,
  onOpen,
  runClientAction,
}: {
  lead: ClientHomeLead;
  eventHref: (eventId: string) => string;
  onOpen: (eventId: string) => void;
  runClientAction: (action: ClientDashboardAction) => void;
}) {
  const { event, action, daysToGo } = lead;
  const coverUrl = useEventCoverUrl(event.id, event.coverObjectId);
  const cover = <EventCover eventType={event.eventType} imageUrl={coverUrl} tag={false} className="h-full" />;
  if (action) {
    return (
      <NextStepHero
        when={action.dueAt ? `due ${formatPortalDate(action.dueAt)}` : undefined}
        title={action.title}
        event={<p><Link href={eventHref(event.id)} onClick={() => onOpen(event.id)} className="font-medium text-ink-foreground hover:underline">{event.eventName}</Link> · {formatPortalDate(event.eventDate)}</p>}
        detail={action.description}
        figure={dueFigure(action.dueAt, manilaDateKey()) ?? eventCountdownFigure(daysToGo)}
        cover={cover}
        action={<Button type="button" onClick={() => runClientAction(action)}>{action.ctaLabel}<ArrowRight className="size-4" /></Button>}
      />
    );
  }
  return (
    <ClientEventHero
      event={event}
      daysToGo={daysToGo}
      backdrop={cover}
      label={daysToGo !== null && daysToGo >= 0 ? "Your next event" : "Your event"}
      eventHref={eventHref(event.id)}
      onOpen={() => onOpen(event.id)}
    >
        <>
          <p className="min-w-0 flex-1 basis-64 text-sm text-ink-foreground/70">Nothing needs you for this event right now. PMCM will let you know when something is ready.</p>
          <Button asChild variant="secondary"><Link href={eventHref(event.id)} onClick={() => onOpen(event.id)}>Open event<ArrowRight className="size-4" /></Link></Button>
        </>
    </ClientEventHero>
  );
}

/**
 * The client's account-wide action list below the hero. `leadActionId` is the step the hero already shows, so it is
 * not listed twice. Settled items stay inside each event's Actions page.
 */
export function ClientHomeActionCenter({
  actionCenter,
  clientActions,
  runClientAction,
  loadFailed = false,
  todayKey,
  leadActionId,
}: {
  actionCenter: PrismClientActionCenter | null;
  clientActions: ClientDashboardAction[];
  runClientAction: (action: ClientDashboardAction) => void;
  loadFailed?: boolean;
  todayKey: string;
  leadActionId?: string;
}) {
  if (loadFailed && !actionCenter) {
    return <p role="status" className="rounded-lg bg-attention-soft px-4 py-3 text-sm text-attention">We could not load your event updates. Refresh the page to try again.</p>;
  }
  if (!actionCenter) return null;
  return (
    <div className="space-y-2">
      <ClientActionLists actions={clientActions} onAction={runClientAction} todayKey={todayKey} scope="account" leadActionId={leadActionId} />
      <p className="text-xs text-muted-foreground">Updated {formatPortalDateTime(actionCenter.generatedAt)} · Philippine time</p>
    </div>
  );
}

export function ClientHomeEvents({
  events,
  viewAllHref,
  requestHref,
  eventHref,
  onOpen,
  todayKey,
  leadEventId,
}: {
  events: PrismEvent[];
  viewAllHref: string;
  requestHref: string;
  eventHref: (eventId: string) => string;
  /** Records the chosen event before its link navigates. */
  onOpen: (eventId: string) => void;
  todayKey: string;
  /** The event the hero already shows, so it is not repeated as a card. */
  leadEventId?: string;
}) {
  if (events.length === 0) {
    return (
      <PrismSection id="client-home-events" title="Your events">
        <PrismEmptyLine
          icon={CalendarDays}
          action={<Button asChild size="sm"><Link href={requestHref}><Send className="size-4" /> Submit an event request</Link></Button>}
        >
          No events yet. Your event workspace opens after PMCM accepts your inquiry and you both sign the conforme.
        </PrismEmptyLine>
      </PrismSection>
    );
  }
  const ordered = orderClientEvents(events);
  const upcoming = ordered.filter((event) => !isPastClientEvent(event) && event.id !== leadEventId).slice(0, 4);
  const pastCount = ordered.filter(isPastClientEvent).length;
  if (upcoming.length === 0 && pastCount === 0) return null;
  return (
    <PrismSection
      id="client-home-events"
      title={leadEventId ? "Your other events" : "Your events"}
      bare
      action={<Link href={viewAllHref} className="text-sm font-medium text-primary hover:text-primary/80">View all</Link>}
    >
      {upcoming.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {upcoming.map((event) => {
            const stage = clientEventStage(event);
            return (
              <li key={event.id}>
                <Link
                  href={eventHref(event.id)}
                  onClick={() => onOpen(event.id)}
                  className="block h-full rounded-lg border border-border bg-card p-5 outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="truncate text-base font-semibold text-foreground" title={event.eventName}>{event.eventName}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[formatPortalDate(event.eventDate), eventCountdown(event.eventDate, todayKey)].filter(Boolean).join(" · ")}
                  </p>
                  <Progress value={stage.percent} className="mt-4" aria-label={`Stage ${stage.number} of ${stage.total}`} />
                  <p className="mt-2 text-xs text-muted-foreground">Stage {stage.number} of {stage.total} · <span className="font-medium text-foreground">{stage.label}</span></p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {pastCount ? (
        <p className={upcoming.length ? "mt-3 text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
          <Link href={`${viewAllHref}/completed`} className="font-medium text-primary hover:text-primary/80">{pastCount === 1 ? "1 past event" : `${pastCount} past events`}</Link> on the Events page.
        </p>
      ) : null}
    </PrismSection>
  );
}

/**
 * Who the client is working with and how to reach them. The portal does not name individual staff
 * to clients, so this is the PMCM team: a message link always, email and phone when the deployment sets them.
 */
export function ClientHomeEventTeam({ messagesHref, email, phone }: { messagesHref: string; email?: string; phone?: string }) {
  return (
    <PrismSection
      id="client-home-team"
      title="Your event team"
      description="PMCM plans and runs your events. Ask them anything about your booking."
      action={<Button asChild variant="outline" size="sm"><Link href={messagesHref}><MessageSquareText className="size-4" /> Message PMCM</Link></Button>}
    >
      {email || phone ? (
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {email ? <a href={`mailto:${email}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"><Mail aria-hidden="true" className="size-4 text-muted-foreground" />{email}</a> : null}
          {phone ? <a href={`tel:${phone}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"><Phone aria-hidden="true" className="size-4 text-muted-foreground" />{phone}</a> : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Messages reach the PMCM team handling your events.</p>
      )}
    </PrismSection>
  );
}
