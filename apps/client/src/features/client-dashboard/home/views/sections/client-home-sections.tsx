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
import { StatusBadge } from "@/app/components/ui/status-badge";
import { ClientActionGroup } from "../../../shared/client-action-group";
import {
  clientFloorplanDashboardActionLabel,
  EventSummaryCard,
  eventProgressDots,
  greetingByTime,
  type ClientDashboardAction,
} from "../../../workspace/shared";
import type { PrismClientActionCenter, PrismClientWorkspace, PrismDocument, PrismEvent, PrismNotificationLog, PrismPaymentMilestone } from "@prism/types";

export function daysUntilEvent(eventDate?: string | null, now = Date.now()): number | null {
  if (!eventDate) return null;
  try {
    const diff = Math.ceil((new Date(eventDate).getTime() - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  } catch {
    return null;
  }
}

function actionCenterIsClear(counts: PrismClientActionCenter["counts"]) {
  return counts.critical === 0 && counts.warning === 0 && counts.attention === 0 && counts.info === 0;
}

export function ClientHomeGreeting({
  sessionName,
  eventCount,
  daysToEvent,
  onRequest,
  onEvents,
}: {
  sessionName: string;
  eventCount: number;
  daysToEvent: number | null;
  onRequest: () => void;
  onEvents: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--prism-signal)] to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/70">P.R.I.S.M Client Portal</p>
            <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
              {greetingByTime(sessionName)}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
              {eventCount > 0
                ? `You have ${eventCount} active event${eventCount === 1 ? "" : "s"} with PMCM. Select an event to review approvals, documents, billing, and planning updates.`
                : "Your portal opens once PMCM accepts your inquiry and records the signed conforme."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="rounded-lg bg-white font-bold text-[var(--prism-signal)] hover:bg-white/90"
                onClick={onRequest}
              >
                <Send className="size-4" /> New event request
              </Button>
              {eventCount > 0 ? (
                <Button
                  variant="ghost"
                  className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white"
                  onClick={onEvents}
                >
                  My events <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
          {daysToEvent !== null ? (
            <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
              <span className="text-4xl font-black leading-none">{daysToEvent}</span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">days to event</span>
            </div>
          ) : null}
        </div>
      </div>
      <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
      <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
    </div>
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
      accent: "text-(--prism-signal)",
      onSelect: () => selectNextSnapshot(nextAction, runClientAction, navigateToEventRoute),
    },
    {
      label: "Layout review",
      value: layoutStatus,
      icon: MapPinned,
      accent: "text-(--prism-amber)",
      onSelect: () => navigateToEventRoute("floorplan"),
    },
    {
      label: nextOpenPayment ? "Next payment" : "Documents",
      value: nextOpenPayment?.dueDate ?? `${documentsNeedingReview.length} needing review`,
      icon: nextOpenPayment ? WalletCards : FileText,
      accent: "text-(--prism-success)",
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
            className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left shadow-sm transition-colors hover:border-(--prism-signal)/30 hover:bg-(--prism-signal-soft)"
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
  fromWorkspaceFallback,
  loadFailed = false,
}: {
  actionCenter: PrismClientActionCenter | null;
  clientActions: ClientDashboardAction[];
  runClientAction: (action: ClientDashboardAction) => void;
  fromWorkspaceFallback?: boolean;
  loadFailed?: boolean;
}) {
  if (loadFailed && !actionCenter) {
    return (
      <section aria-labelledby="client-action-center-heading" className="space-y-4">
        <h2 id="client-action-center-heading" className="text-base font-black text-foreground">Action center</h2>
        <div role="status" className="rounded-2xl border border-(--prism-amber)/20 bg-(--prism-amber)/8 px-5 py-6 text-sm text-muted-foreground">
          Action center data is temporarily unavailable. Refresh to check for persisted next actions.
        </div>
      </section>
    );
  }
  if (!actionCenter) return null;
  if (clientActions.length === 0 && !fromWorkspaceFallback) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-base font-black text-foreground">Action center</h2>
      {fromWorkspaceFallback ? (
        <p className="rounded-xl border border-(--prism-amber)/20 bg-(--prism-amber)/8 px-4 py-3 text-xs text-muted-foreground">
          Showing next actions from your workspace because the action center could not load. This is a labeled fallback, not live command-inbox data.
        </p>
      ) : null}
      <ClientActionGroup title="Needs your action" description="Client decisions that can move planning forward." actions={clientActions.filter((a) => a.tone === "primary" || a.tone === "warning")} onAction={runClientAction} />
      <ClientActionGroup title="Waiting on PMCM" description="Being prepared or reviewed by the event team." actions={clientActions.filter((a) => a.tone === "neutral")} onAction={runClientAction} />
      {actionCenterIsClear(actionCenter.counts) ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-(--prism-success)/10">
            <CheckCircle2 className="size-5 text-(--prism-success)" />
          </span>
          <h3 className="mt-4 text-sm font-bold text-foreground">No pending actions yet.</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">All event items are up to date. PMCM will notify you when something needs your attention.</p>
        </div>
      ) : null}
    </div>
  );
}

export function ClientHomeEvents({
  events,
  state,
  onViewAll,
  onRequest,
  onOpen,
  onOpenFloorplan,
}: {
  events: PrismEvent[];
  state: PrismClientWorkspace;
  onViewAll: () => void;
  onRequest: () => void;
  onOpen: (eventId: string) => void;
  onOpenFloorplan: (eventId: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--prism-signal-soft)]">
          <CalendarDays className="size-6 text-[var(--prism-signal)]" />
        </span>
        <h3 className="mt-4 text-base font-black text-foreground">No events yet.</h3>
        <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground">
          Your event workspace opens after PMCM accepts your inquiry and records the signed conforme. Submit a request to get started.
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
          className="inline-flex items-center gap-1 text-xs font-semibold text-(--prism-signal) hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--prism-signal) focus-visible:ring-offset-2"
        >
          View all <ArrowRight className="size-3" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.slice(0, 3).map((ev) => (
          <EventSummaryCard
            key={ev.id}
            event={ev}
            dots={eventProgressDots(ev, state)}
            billingStatement={state.billingStatements.find((b) => b.eventId === ev.id)}
            briefing={state.briefings.find((b) => b.eventId === ev.id)}
            documentCount={state.documents.filter((document) => document.eventId === ev.id).length}
            onOpen={() => onOpen(ev.id)}
            onOpenFloorplan={() => onOpenFloorplan(ev.id)}
            floorplanActionLabel={clientFloorplanDashboardActionLabel(ev.floorPlanStatus)}
          />
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
          <Sparkles className="size-4 text-(--prism-signal)" />
          <p className="text-sm font-bold text-foreground">Recent updates from PMCM</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
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

