"use client";

import { LogOut } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismGuestShell, PrismNoticeBanner } from "@prism/ui";
import { portalHref } from "@prism/ui/portal-path";
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
  const feedbackOpen = session.feedbackAvailability === "open" || vm.canWithdrawFeedbackConsent;

  return (
    <PrismGuestShell
      eventName={session.eventName}
      detail={
        <>
          {formatPortalDate(session.eventDate)} · Hosted by {session.clientName}
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
          {vm.error ? <PrismNoticeBanner role="alert" tone="danger">{vm.error}</PrismNoticeBanner> : null}
          {vm.notice ? <PrismNoticeBanner role="status" tone="success">{vm.notice}</PrismNoticeBanner> : null}
          {vm.refreshFailed ? <PrismNoticeBanner role="status" tone="warning">We could not refresh the event details. Your last loaded pass is shown. Check with registration for current instructions.</PrismNoticeBanner> : null}
          <nav aria-label="Guest pass sections" className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <a className="inline-flex min-h-11 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:ring-primary" href="#check-in">Check in</a>
            <a className="inline-flex min-h-11 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:ring-primary" href="#event-details">Event details</a>
            <a className="inline-flex min-h-11 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:ring-primary" href={portalHref("/games/join")}>Join a game</a>
            {feedbackOpen ? <a className="inline-flex min-h-11 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:ring-primary" href="#feedback">Feedback</a> : null}
          </nav>
          <div id="check-in"><GuestCheckInPanel vm={vm} /></div>
          <div id="event-details"><GuestEventDetailsPanel session={session} /></div>
          {feedbackOpen ? <div id="feedback"><GuestFeedbackPanel vm={vm} /></div> : null}
        </div>
    </PrismGuestShell>
  );
}
