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
import { EventSummaryCard } from "../../workspace/shared";
import {
  eventProgressDots,
  formatStatusLabel,
  greetingByTime,
} from "../../workspace/shared";
import { dashboardHref } from "../../workspace/shared";
import { ClientActionGroup } from "../../shared/client-action-group";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientHomeView() {
  const {
    router,
    session,
    state,
    actionCenter,
    events,
    selectedEvent,
    setSelectedEventId,
    officialDraft,
    documents,
    payments,
    clientActions,
    nextAction,
    notifications,
    navigateToEventRoute,
    runClientAction,
  } = useClientWorkspace();
  if (!state) return null;

    const daysToEvent = (() => {
      if (!selectedEvent?.eventDate) return null;
      try {
        const diff = Math.ceil(
          (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return diff > 0 ? diff : 0;
      } catch {
        return null;
      }
    })();
    const nextOpenPayment = payments.find((p) => p.status !== "paid");
    const documentsNeedingReview = documents.filter((document) => /needs|pending|requested/i.test(document.status));
    const layoutStatus = officialDraft ? formatStatusLabel(officialDraft.status) : "Not started";
  
    return (
      <div className="space-y-6">
        {/* Greeting banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--prism-signal)] to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/70">P.R.I.S.M Client Portal</p>
                <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                  {greetingByTime(session.name)}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                  {events.length > 0
                    ? `You have ${events.length} active event${events.length === 1 ? "" : "s"} with PMCM. Select an event to review approvals, documents, billing, and planning updates.`
                    : "Your portal opens once PMCM accepts your inquiry and records the signed conforme."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    className="rounded-lg bg-white font-bold text-[var(--prism-signal)] hover:bg-white/90"
                    onClick={() => router.push("/dashboard/request")}
                  >
                    <Send className="size-4" /> New event request
                  </Button>
                  {events.length > 0 && (
                    <Button
                      variant="ghost"
                      className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white"
                      onClick={() => router.push("/dashboard/events")}
                    >
                      My events <ArrowRight className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              {daysToEvent !== null && (
                <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
                  <span className="text-4xl font-black leading-none">{daysToEvent}</span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">days to event</span>
                </div>
              )}
            </div>
          </div>
          {/* decorative circles */}
          <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
          <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
        </div>
  
        {selectedEvent && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Next action",
                value: nextAction?.title ?? "No client action pending",
                icon: FileCheck2,
                accent: "text-(--prism-signal)",
                onSelect: () => nextAction ? runClientAction(nextAction) : navigateToEventRoute("overview"),
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
                onSelect: () => nextOpenPayment ? navigateToEventRoute("billing") : navigateToEventRoute("documents"),
              },
            ].map((item) => {
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
        )}
  
        {/* Action center groups — contract-first actions from API */}
        {actionCenter && clientActions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-black text-foreground">Action center</h2>
            <ClientActionGroup title="Needs your action" description="Client decisions that can move planning forward." actions={clientActions.filter((a) => a.tone === "primary" || a.tone === "warning")} onAction={runClientAction} />
            <ClientActionGroup title="Waiting on PMCM" description="Being prepared or reviewed by the event team." actions={clientActions.filter((a) => a.tone === "neutral")} onAction={runClientAction} />
            {actionCenter.counts.critical === 0 && actionCenter.counts.warning === 0 && actionCenter.counts.attention === 0 && actionCenter.counts.info === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-(--prism-success)/10">
                  <CheckCircle2 className="size-5 text-(--prism-success)" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-foreground">No pending actions yet.</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">All event items are up to date. PMCM will notify you when something needs your attention.</p>
              </div>
            )}
          </div>
        )}
  
        {/* Event card grid */}
        {events.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-foreground">Your events</h2>
              <button
                type="button"
                onClick={() => router.push("/dashboard/events")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-(--prism-signal) hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.slice(0, 3).map((ev) => {
                const dots = eventProgressDots(ev, state);
                const statement = state.billingStatements.find((b) => b.eventId === ev.id);
                const eventBriefing = state.briefings.find((b) => b.eventId === ev.id);
                const eventDocs = state.documents.filter((document) => document.eventId === ev.id);
                return (
                  <EventSummaryCard
                    key={ev.id}
                    event={ev}
                    dots={dots}
                    billingStatement={statement}
                    briefing={eventBriefing}
                    documentCount={eventDocs.length}
                    onOpen={() => {
                      setSelectedEventId(ev.id);
                      router.push(dashboardHref("overview", ev.id));
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--prism-signal-soft)]">
              <CalendarDays className="size-6 text-[var(--prism-signal)]" />
            </span>
            <h3 className="mt-4 text-base font-black text-foreground">No events yet.</h3>
            <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground">
              Your event workspace opens after PMCM accepts your inquiry and records the signed conforme. Submit a request to get started.
            </p>
            <Button className="mt-5 rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
              <Send className="size-4" /> Submit an event request
            </Button>
          </div>
        )}
  
        {/* Recent updates */}
        {notifications.length > 0 && (
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
        )}
      </div>
    );
}
