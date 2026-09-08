"use client";

import { LogOut, TicketCheck } from "lucide-react";
import { PrismNoticeBanner } from "@prism/ui";
import { guestNextActions, humanizeToken } from "../model/guest-dashboard-rules";
import { useGuestDashboardViewModel } from "../view-models/use-guest-dashboard-view-model";
import {
  GuestCheckInPanel,
  GuestEventDetailsPanel,
  GuestFeedbackPanel,
} from "./sections/guest-dashboard-panels";

function GuestDashboardLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
        <p className="text-sm text-muted-foreground">Loading event pass…</p>
      </div>
    </main>
  );
}

export function GuestDashboardView() {
  const vm = useGuestDashboardViewModel();
  const session = vm.session;

  if (!session) return <GuestDashboardLoading />;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border bg-(--prism-ink)">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#171216,#251722_48%,#10242b)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative mx-auto flex max-w-5xl items-start justify-between gap-6 px-5 py-8 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">
              Guest access
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-sidebar-foreground sm:text-4xl">
              Guest Registration · {session.eventName}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-sidebar-foreground/66">
              Code-gated check-in and moderated feedback. Enter your name or
              record headcount for this event.
            </p>
            <p className="mt-4 text-sm text-sidebar-foreground/50">
              {session.attendanceCount} guest
              {session.attendanceCount === 1 ? "" : "s"} checked in
            </p>
          </div>

          <div className="hidden w-56 shrink-0 rounded-lg border border-white/10 bg-white/6 p-5 text-sidebar-foreground sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">
              Guest pass
            </p>
            <p className="mt-2 text-base font-black leading-tight">
              {session.eventName}
            </p>
            <p className="mt-0.5 text-xs text-sidebar-foreground/60">
              {session.eventDate}
            </p>
            <div className="mt-3 grid place-items-center rounded-md bg-white/6 p-4">
              <TicketCheck className="size-16 text-sidebar-foreground/40" />
              <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-sidebar-foreground/50">
                Access code
              </p>
              <p className="mt-1 text-center text-xs font-black text-(--prism-amber)">
                {session.guestAccessCode}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5">
          {vm.error ? <PrismNoticeBanner tone="danger">{vm.error}</PrismNoticeBanner> : null}
          {vm.notice ? <PrismNoticeBanner tone="success">{vm.notice}</PrismNoticeBanner> : null}
          <section aria-labelledby="guest-action-center-heading" className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 id="guest-action-center-heading" className="text-base font-black text-foreground">Your next steps</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {guestNextActions(vm.checkedIn, vm.feedbackSubmitted).map((action) => (
                <div key={action.id} className="border-l border-(--prism-signal) bg-background/60 px-3 py-2.5">
                  <p className="text-sm font-bold text-foreground">{action.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <GuestCheckInPanel vm={vm} />
          <GuestEventDetailsPanel
            session={session}
            checkedIn={vm.checkedIn}
            feedbackSubmitted={vm.feedbackSubmitted}
          />
          <GuestFeedbackPanel vm={vm} />
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">Current readiness</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{humanizeToken(session.readiness)}</p>
            </div>
            <button
              type="button"
              onClick={() => vm.leave()}
              className="text-sm font-bold text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="mr-1.5 inline size-3.5" />
              Leave event
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
