"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { derivePrismLifecycleStage, type PrismClientActionItem, type PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { formatPortalDate } from "@prism/ui/format-date";
import { AttentionList, CountdownPill, EventCard, EventCardGrid, EventCardHeader, StageTrack, eventCountdown } from "@prism/ui/event-cards";
import { clientEventCardOpenRoute, dashboardHref } from "../../workspace/shared";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";
import { isPastClientEvent } from "../../home/model/client-home-summary";

type CardProps = { event: PrismEvent; action?: PrismClientActionItem; todayKey: string; onOpen: (id: string) => void };

const eventHref = (event: PrismEvent) => dashboardHref(clientEventCardOpenRoute(event), event.id);

/** The client's own most urgent step on an event; informational items are not steps. */
export function nextClientAction(event: PrismEvent, actions: PrismClientActionItem[]): PrismClientActionItem | undefined {
  return actions.find((item) => item.eventId === event.id && item.priority !== "info");
}

function NextStep({ event, action }: { event: PrismEvent; action?: PrismClientActionItem }) {
  if (!action) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 aria-hidden className="size-4" />Nothing waiting on you right now
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-soft px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">Your next step</p>
        <p className="font-semibold text-foreground">{action.label}</p>
      </div>
      <Button asChild size="sm" className="relative z-10 ml-auto shrink-0"><Link href={action.href ?? eventHref(event)}>Open</Link></Button>
    </div>
  );
}

/** The client's nearest event, large: how many days are left, where it stands, and what they need to do. */
export function NextEventHero({ event, action, todayKey, onOpen }: CardProps) {
  const countdown = eventCountdown(event.eventDate, todayKey);
  const days = countdown && countdown.days >= 0 ? countdown.days : null;
  return (
    <EventCard urgent={action?.priority === "critical"} className="gap-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Your next event</p>
          <EventCardHeader date={event.eventDate} title={event.eventName} href={eventHref(event)} onNavigate={() => onOpen(event.id)}
            details={[formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed"].join(" · ")} />
        </div>
        {days !== null ? (
          <p className="text-center leading-none">
            <span className="block text-4xl font-bold tabular-nums text-primary">{days === 0 ? "Today" : days}</span>
            {days === 0 ? null : <span className="text-[11px] text-muted-foreground">{days === 1 ? "day to go" : "days to go"}</span>}
          </p>
        ) : null}
      </div>
      <StageTrack stage={derivePrismLifecycleStage(event)} />
      <NextStep event={event} action={action} />
    </EventCard>
  );
}

/** Any other event: date, how far away, stage, and the client's next step on it. A finished event is a short card. */
export function ClientEventCard({ event, action, todayKey, onOpen }: CardProps) {
  const past = isPastClientEvent(event);
  return (
    <EventCard urgent={action?.priority === "critical"} compact={past}>
      <EventCardHeader date={event.eventDate} title={event.eventName} href={eventHref(event)} onNavigate={() => onOpen(event.id)} muted={past}
        details={past ? `${formatStatusLabel(event.status)} · View summary` : event.venue || "Venue to be confirmed"}
        aside={past ? null : <CountdownPill date={event.eventDate} todayKey={todayKey} />} />
      {past ? null : <StageTrack stage={derivePrismLifecycleStage(event)} />}
      {action ? <AttentionList lines={[{ id: action.id, severity: action.priority, text: action.label, href: action.href }]} link={Link} /> : null}
      {past || action ? null : <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 aria-hidden className="size-3.5" />Nothing waiting on you</p>}
    </EventCard>
  );
}

/** The soonest event still ahead (today counts); an open event whose date has passed is not "next". */
export function featuredClientEvent(events: PrismEvent[], todayKey: string): PrismEvent | undefined {
  return events.find((event) => !isPastClientEvent(event) && (eventCountdown(event.eventDate, todayKey)?.days ?? -1) >= 0);
}

/** The client's events as cards: the soonest one ahead large, then the rest in a grid. */
export function ClientEventCards({ events, actions, todayKey, onOpen, featureFirst }: {
  events: PrismEvent[];
  actions: PrismClientActionItem[];
  todayKey: string;
  onOpen: (id: string) => void;
  /** Show the first event large; off while searching, so results keep one shape. */
  featureFirst: boolean;
}) {
  const feature = featureFirst ? featuredClientEvent(events, todayKey) : undefined;
  const grid = events.filter((event) => event !== feature);
  return (
    <div className="grid gap-4">
      {feature ? <NextEventHero event={feature} action={nextClientAction(feature, actions)} todayKey={todayKey} onOpen={onOpen} /> : null}
      {grid.length ? (
        <EventCardGrid>
          {grid.map((event) => <ClientEventCard key={event.id} event={event} action={nextClientAction(event, actions)} todayKey={todayKey} onOpen={onOpen} />)}
        </EventCardGrid>
      ) : null}
    </div>
  );
}
