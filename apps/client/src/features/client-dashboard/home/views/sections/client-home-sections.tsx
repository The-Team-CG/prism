"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  MapPinned,
  Send,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { ClientActionGroup } from "../../../shared/client-action-group";
import {
  greetingByTime,
  type ClientDashboardAction,
} from "../../../workspace/shared";
import type { PrismClientActionCenter, PrismDocument, PrismEvent, PrismNotificationLog, PrismPaymentMilestone } from "@prism/types";

export function daysUntilEvent(eventDate?: string | null, now = Date.now()): number | null {
  if (!eventDate) return null;
  try {
    const diff = Math.ceil((new Date(eventDate).getTime() - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  } catch {
    return null;
  }
}

export function ClientHomeGreeting({
  sessionName,
  eventCount,
  daysToEvent,
  onRequest,
  onEvents,
  onReviewConforme,
}: {
  sessionName: string;
  eventCount: number;
  daysToEvent: number | null;
  onRequest: () => void;
  onEvents: () => void;
  onReviewConforme: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight text-foreground">{greetingByTime(sessionName)}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {eventCount > 0
            ? `You have ${eventCount} active event${eventCount === 1 ? "" : "s"} with PMCM. Open an event to review approvals, documents, billing and planning updates.`
            : "Your event workspace opens after PMCM accepts your inquiry and both you and PMCM acknowledge the conforme. Review it here when PMCM has prepared it."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button className="h-10 rounded-md font-semibold" onClick={onRequest}>
            <Send className="size-4" aria-hidden="true" /> New event request
          </Button>
          {eventCount > 0 ? (
            <button type="button" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:text-primary/80" onClick={onEvents}>
              My events <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:text-primary/80" onClick={onReviewConforme}>
            Review conforme <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {daysToEvent !== null ? (
        <p className="shrink-0 text-sm text-muted-foreground sm:text-right">
          <span className="block text-3xl font-semibold tabular-nums text-foreground">{daysToEvent}</span>
          days to your next event
        </p>
      ) : null}
    </header>
  );
}

function selectNextSnapshot(nextAction: ClientDashboardAction | undefined, run: (action: ClientDashboardAction) => void, navigate: (tab: "overview") => void) {
  if (nextAction) {
    run(nextAction);
    return;
  }
  navigate("overview");
}

export function ClientHomeSnapshots({
  nextAction,
  layoutStatus,
  nextOpenPayment,
  documentsNeedingReview,
  runClientAction,
  navigateToEventRoute,
}: {
  nextAction?: ClientDashboardAction;
  layoutStatus: string;
  nextOpenPayment?: PrismPaymentMilestone;
  documentsNeedingReview: PrismDocument[];
  runClientAction: (action: ClientDashboardAction) => void;
  navigateToEventRoute: (route: "overview" | "floorplan" | "billing" | "documents") => void;
}) {
  const items = [
    {
      label: "Next action",
      value: nextAction?.title ?? "No client action pending",
      icon: FileCheck2,
      accent: "text-primary",
      onSelect: () => selectNextSnapshot(nextAction, runClientAction, navigateToEventRoute),
    },
    {
      label: "Layout review",
      value: layoutStatus,
      icon: MapPinned,
      accent: "text-attention",
      onSelect: () => navigateToEventRoute("floorplan"),
    },
    {
      label: nextOpenPayment ? "Next payment" : "Documents",
      value: nextOpenPayment?.dueDate ?? `${documentsNeedingReview.length} needing review`,
      icon: nextOpenPayment ? WalletCards : FileText,
      accent: "text-success",
      onSelect: () => navigateToEventRoute(nextOpenPayment ? "billing" : "documents"),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onSelect}
            className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-soft"
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-muted ${item.accent}`}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight text-foreground">{item.value}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ClientHomeActionCenter({
  actionCenter,
  clientActions,
  runClientAction,
  loadFailed = false,
}: {
  actionCenter: PrismClientActionCenter | null;
  clientActions: ClientDashboardAction[];
  runClientAction: (action: ClientDashboardAction) => void;
  loadFailed?: boolean;
}) {
  if (loadFailed && !actionCenter) {
    return (
      <section aria-labelledby="client-action-center-heading" className="space-y-4">
        <h2 id="client-action-center-heading" className="text-base font-black text-foreground">Action center</h2>
        <div role="status" className="rounded-2xl border border-attention/20 bg-attention/8 px-5 py-6 text-sm text-muted-foreground">
          We could not load your event updates. Refresh the page to try again.
        </div>
      </section>
    );
  }
  if (!actionCenter) return null;
  if (clientActions.length === 0) {
    return (
      <section aria-labelledby="client-action-center-heading" className="space-y-4">
        <h2 id="client-action-center-heading" className="text-base font-black text-foreground">Action center</h2>
        <div role="status" className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-success/10">
            <CheckCircle2 className="size-5 text-success" />
          </span>
          <h3 className="mt-4 text-sm font-bold text-foreground">No pending actions</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">No pending items were returned in this update. You can still open an event to review its progress.</p>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="client-action-center-heading" className="space-y-4">
      <h2 id="client-action-center-heading" className="text-base font-black text-foreground">Action center</h2>
      <p className="text-xs text-muted-foreground">Updated {formatPortalDateTime(actionCenter.generatedAt)} · Philippine time</p>
      {([
        { actor: "you", title: "Needs your action", description: "Review these items and choose the next step." },
        { actor: "pmcm", title: "Waiting for PMCM", description: "Your item is with PMCM. Open it to review the current status." },
        { actor: "update", title: "Available to review", description: "New records and information for your events." },
      ] as const).map((group) => {
        const actions = clientActions.filter((action) => (action.nextActor ?? "you") === group.actor);
        return actions.length ? <ClientActionGroup key={group.actor} title={group.title} description={group.description} actions={actions} onAction={runClientAction} showDetailsAndCta /> : null;
      })}
    </section>
  );
}

export function ClientHomeEvents({
  events,
  onViewAll,
  onRequest,
  onOpen,
}: {
  events: PrismEvent[];
  onViewAll: () => void;
  onRequest: () => void;
  onOpen: (eventId: string) => void;
}) {
  const isPastEvent = (event: PrismEvent) => ["completed", "cancelled", "closed"].includes(event.status);
  const upcomingEvents = events.filter((event) => !isPastEvent(event)).sort((left, right) => left.eventDate.localeCompare(right.eventDate));
  const pastEvents = events.filter(isPastEvent).sort((left, right) => right.eventDate.localeCompare(left.eventDate));
  const previewEvents = [...upcomingEvents, ...pastEvents].slice(0, 3);
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft">
          <CalendarDays className="size-6 text-primary" />
        </span>
        <h3 className="mt-4 text-base font-black text-foreground">No events yet.</h3>
        <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground">
          Your event workspace opens after PMCM accepts your inquiry and both you and PMCM acknowledge the conforme. If PMCM has prepared one, review it here; otherwise, submit a request to get started.
        </p>
        <Button className="mt-5 rounded-lg font-bold" onClick={onRequest}>
          <Send className="size-4" /> Submit an event request
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-foreground">Your events</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all <ArrowRight className="size-3" />
        </button>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {previewEvents.map((ev) => (
          <div key={ev.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{ev.eventName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatPortalDate(ev.eventDate)} · {ev.status.replaceAll("_", " ")}</p>
              {ev.venue ? <p className="mt-1 text-xs text-muted-foreground">{ev.venue}</p> : null}
            </div>
            <Button variant="outline" onClick={() => onOpen(ev.id)}>Open event</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientHomeUpdates({ notifications }: { notifications: PrismNotificationLog[] }) {
  if (notifications.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Recent updates from PMCM</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-3xs font-black text-primary">
              PM
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{n.channel.toUpperCase()} update</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground line-clamp-2">{n.message}</p>
            </div>
            <StatusBadge status={n.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

