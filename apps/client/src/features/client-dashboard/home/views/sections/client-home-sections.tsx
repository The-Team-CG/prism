"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Mail, MessageSquareText, Phone, Send } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismClientActionCenter, PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Progress } from "@prism/ui/components/progress";
import { PrismEmptyLine, PrismSection, PrismSectionGroupLabel } from "@prism/ui/page-blocks";
import { ClientEventHero, ClientEventHeroStep, clientEventStage } from "../../../shared/client-event-hero";
import { formatStatusLabel, type ClientDashboardAction } from "../../../workspace/shared";
import { ClientListEmpty, ClientListRow } from "../../../shared/client-list-ui";
import { groupClientActionsByEvent } from "../../model/client-home-action-groups";
import { clientActionRowTone, dueState, eventCountdown, isPastClientEvent, orderClientActionsByUrgency, orderClientEvents, type ClientHomeLead } from "../../model/client-home-summary";

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
  return (
    <ClientEventHero
      event={event}
      daysToGo={daysToGo}
      label={daysToGo !== null && daysToGo >= 0 ? "Your next event" : "Your event"}
      eventHref={eventHref(event.id)}
      onOpen={() => onOpen(event.id)}
    >
      {action ? (
        <>
          <ClientEventHeroStep title={action.title} description={action.description || undefined} />
          <Button type="button" onClick={() => runClientAction(action)}>{action.ctaLabel}<ArrowRight className="size-4" /></Button>
        </>
      ) : (
        <>
          <p className="min-w-0 flex-1 basis-64 text-sm text-ink-foreground/70">Nothing needs you for this event right now. PMCM will let you know when something is ready.</p>
          <Button asChild variant="secondary"><Link href={eventHref(event.id)} onClick={() => onOpen(event.id)}>Open event<ArrowRight className="size-4" /></Link></Button>
        </>
      )}
    </ClientEventHero>
  );
}

function ActionRow({ action, todayKey, onAction, showEvent }: { action: ClientDashboardAction; todayKey: string; onAction: (action: ClientDashboardAction) => void; showEvent: boolean }) {
  const due = dueState(action.dueAt, todayKey);
  const tone = clientActionRowTone(action);
  const meta = [showEvent ? action.eventName : null, action.description].filter(Boolean).join(" · ");
  return (
    <ClientListRow
      icon={action.icon}
      tone={tone}
      title={action.title}
      meta={meta || undefined}
      tag={action.priority === "critical" ? "Blocking" : undefined}
      status={due?.label ?? formatStatusLabel(action.status)}
      statusTitle={action.dueAt ? formatPortalDateTime(action.dueAt) : undefined}
      action={action.ctaLabel}
      onOpen={() => onAction(action)}
    />
  );
}

/**
 * What needs the client, as one list ordered by urgency and grouped by event when the items span
 * more than one event. `leadActionId` is the step the hero already shows, so it is not listed twice.
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
  const own = clientActions.filter((action) => (action.nextActor ?? "you") === "you");
  const withPmcm = clientActions.filter((action) => action.nextActor === "pmcm");
  const updates = clientActions.filter((action) => action.nextActor === "update");
  if (clientActions.length === 0) {
    return <ClientListEmpty icon={CheckCircle2} title="You're all caught up" description="Nothing needs you right now. PMCM will let you know when something is ready for you." />;
  }
  const rest = orderClientActionsByUrgency(own).filter((action) => action.id !== leadActionId);
  const several = new Set(own.map((action) => action.eventId ?? "")).size > 1;
  const groups = groupClientActionsByEvent(rest);
  return (
    <div className="space-y-6">
      {rest.length ? (
        <PrismSection id="client-actions" title={rest.length === own.length ? "Needs you" : "Also needs you"} count={rest.length} flush>
          {groups.map((group, index) => (
            <div key={group.eventId || "account"} className={index ? "border-t border-border" : undefined}>
              {several ? <PrismSectionGroupLabel>{group.eventName}</PrismSectionGroupLabel> : null}
              <ul className="divide-y divide-border">
                {[...group.now, ...group.later].map((action) => <ActionRow key={action.id} action={action} todayKey={todayKey} onAction={runClientAction} showEvent={false} />)}
              </ul>
            </div>
          ))}
        </PrismSection>
      ) : null}
      {withPmcm.length ? (
        <PrismSection id="client-actions-pmcm" title="Waiting for PMCM" count={withPmcm.length} description="These are with PMCM. Open one to see where it stands." flush>
          <ul className="divide-y divide-border">
            {withPmcm.map((action) => <ActionRow key={action.id} action={{ ...action, priority: "info", blocking: false }} todayKey={todayKey} onAction={runClientAction} showEvent={several} />)}
          </ul>
        </PrismSection>
      ) : null}
      {updates.length ? (
        <PrismSection id="client-actions-updates" title="New to review" count={updates.length} flush>
          <ul className="divide-y divide-border">
            {updates.map((action) => <ActionRow key={action.id} action={{ ...action, priority: "info", blocking: false }} todayKey={todayKey} onAction={runClientAction} showEvent={several} />)}
          </ul>
        </PrismSection>
      ) : null}
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
