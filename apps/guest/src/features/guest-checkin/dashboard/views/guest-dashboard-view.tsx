"use client";

import { LogOut } from "lucide-react";
import { PrismGuestShell, PrismNoticeBanner } from "@prism/ui";
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
    <PrismGuestShell
      eventName={session.eventName}
      detail={
        <>
          {session.eventDate} · Access code <span className="font-semibold tabular-nums text-foreground">{session.guestAccessCode}</span>
        </>
      }
      actions={
        <button type="button" onClick={() => vm.leave()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <LogOut aria-hidden="true" className="size-4" />
          Leave event
        </button>
      }
    >
        <div className="flex flex-col gap-5">
          {vm.error ? <PrismNoticeBanner tone="danger">{vm.error}</PrismNoticeBanner> : null}
          {vm.notice ? <PrismNoticeBanner tone="success">{vm.notice}</PrismNoticeBanner> : null}
          <section aria-labelledby="guest-action-center-heading" className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 id="guest-action-center-heading" className="text-base font-black text-foreground">Your next steps</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {guestNextActions(vm.checkedIn, vm.feedbackSubmitted).map((action) => (
                <div key={action.id} className="border-l border-primary bg-background/60 px-3 py-2.5">
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
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Current readiness</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{humanizeToken(session.readiness)}</p>
          </div>
        </div>
    </PrismGuestShell>
  );
}
