"use client";

import { LogOut } from "lucide-react";
import { PrismGuestShell, PrismNoticeBanner } from "@prism/ui";
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
  const feedbackOpen = session.feedbackAvailability === "open";

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
          <nav aria-label="Guest pass sections" className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <a href="#check-in">My pass</a>
            <a href="#event-details">Event details</a>
            {feedbackOpen ? <a href="#feedback">Feedback</a> : null}
          </nav>
          <div id="check-in"><GuestCheckInPanel vm={vm} /></div>
          <div id="event-details"><GuestEventDetailsPanel session={session} /></div>
          {feedbackOpen ? <div id="feedback"><GuestFeedbackPanel vm={vm} /></div> : null}
        </div>
    </PrismGuestShell>
  );
}
