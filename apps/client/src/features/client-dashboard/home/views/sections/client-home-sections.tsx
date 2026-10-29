"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, Send } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismClientActionCenter, PrismEvent } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { formatStatusLabel, type ClientDashboardAction } from "../../../workspace/shared";
import { ClientListEmpty, ClientListRow, ClientListSection } from "../../../shared/client-list-ui";
import { groupClientActionsByEvent } from "../../model/client-home-action-groups";
import { clientActionRowTone, dueState, eventCountdown, isPastClientEvent, orderClientEvents } from "../../model/client-home-summary";

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

export function ClientHomeActionCenter({
  actionCenter,
  clientActions,
  runClientAction,
  loadFailed = false,
  todayKey,
}: {
  actionCenter: PrismClientActionCenter | null;
  clientActions: ClientDashboardAction[];
  runClientAction: (action: ClientDashboardAction) => void;
  loadFailed?: boolean;
  todayKey: string;
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
  const groups = groupClientActionsByEvent(own);
  const several = groups.length > 1;
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <ClientListSection
          key={group.eventId}
          id={`client-actions-${group.eventId || "account"}`}
          title={several ? `Needs your action · ${group.eventName}` : "Needs your action"}
          count={group.now.length + group.later.length}
          description={group.later.length && group.now.length ? "Current blockers first; later-stage requirements can wait." : undefined}
        >
          {[...group.now, ...group.later].map((action) => <ActionRow key={action.id} action={action} todayKey={todayKey} onAction={runClientAction} showEvent={false} />)}
        </ClientListSection>
      ))}
      {withPmcm.length ? (
        <ClientListSection id="client-actions-pmcm" title="Waiting for PMCM" count={withPmcm.length} description="These are with PMCM. Open one to see where it stands.">
          {withPmcm.map((action) => <ActionRow key={action.id} action={{ ...action, priority: "info", blocking: false }} todayKey={todayKey} onAction={runClientAction} showEvent={several} />)}
        </ClientListSection>
      ) : null}
      {updates.length ? (
        <ClientListSection id="client-actions-updates" title="New to review" count={updates.length}>
          {updates.map((action) => <ActionRow key={action.id} action={{ ...action, priority: "info", blocking: false }} todayKey={todayKey} onAction={runClientAction} showEvent={several} />)}
        </ClientListSection>
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
}: {
  events: PrismEvent[];
  viewAllHref: string;
  requestHref: string;
  eventHref: (eventId: string) => string;
  /** Records the chosen event before its link navigates. */
  onOpen: (eventId: string) => void;
  todayKey: string;
}) {
  if (events.length === 0) {
    return (
      <ClientListEmpty
        icon={CalendarDays}
        title="No events yet"
        description="Your event workspace opens after PMCM accepts your inquiry and you both sign the conforme."
        action={<Button asChild className="rounded-lg font-semibold"><Link href={requestHref}><Send className="size-4" /> Submit an event request</Link></Button>}
      />
    );
  }
  const preview = orderClientEvents(events).slice(0, 4);
  return (
    <ClientListSection
      id="client-home-events"
      title="Your events"
      count={events.length}
      action={<Link href={viewAllHref} className="text-sm font-medium text-primary hover:text-primary/80">View all</Link>}
    >
      {preview.map((event) => {
        const past = isPastClientEvent(event);
        return (
          <ClientListRow
            key={event.id}
            icon={CalendarDays}
            title={event.eventName}
            meta={[formatPortalDate(event.eventDate), event.venue || "Venue to be confirmed", formatStatusLabel(event.status)].join(" · ")}
            status={past ? formatStatusLabel(event.status) : eventCountdown(event.eventDate, todayKey) ?? "Date pending"}
            action="Open event"
            href={eventHref(event.id)}
            onOpen={() => onOpen(event.id)}
          />
        );
      })}
    </ClientListSection>
  );
}
