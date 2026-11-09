"use client";

import { LogOut } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismGuestShell, PrismNoticeBanner } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { portalHref } from "@prism/ui/portal-path";
import { useGuestDashboardViewModel } from "../view-models/use-guest-dashboard-view-model";
import { isGuestCheckInOpen } from "../model/guest-dashboard-rules";
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

type GuestDashboardVm = ReturnType<typeof useGuestDashboardViewModel>;

function GuestDashboardNotices({ vm }: { vm: GuestDashboardVm }) {
  return (
    <>
      {vm.error ? <PrismNoticeBanner role="alert" tone="danger">{vm.error}</PrismNoticeBanner> : null}
      {vm.notice ? <PrismNoticeBanner role="status" tone="success">{vm.notice}</PrismNoticeBanner> : null}
      {vm.refreshFailed ? <PrismNoticeBanner role="status" tone="warning">We could not refresh the event details. Your last loaded pass is shown. Check with registration for current instructions.</PrismNoticeBanner> : null}
    </>
  );
}

function GuestPassNav({ checkInOpen, feedbackOpen }: { checkInOpen: boolean; feedbackOpen: boolean }) {
  return (
    <nav aria-label="Guest pass sections" className="flex flex-wrap gap-2">
      {checkInOpen ? <Button asChild variant="ghost" className="min-h-11 px-3 font-semibold"><a href="#check-in">Check in</a></Button> : null}
      <Button asChild variant="ghost" className="min-h-11 px-3 font-semibold"><a href="#event-details">Event details</a></Button>
      <Button asChild variant="ghost" className="min-h-11 px-3 font-semibold"><a href={portalHref("/games/join")}>Join a game</a></Button>
      {feedbackOpen ? <Button asChild variant="ghost" className="min-h-11 px-3 font-semibold"><a href="#feedback">Feedback</a></Button> : null}
    </nav>
  );
}

export function GuestDashboardView() {
  const vm = useGuestDashboardViewModel();
  const session = vm.session;

  if (!session) return <GuestDashboardLoading />;
  const feedbackOpen = session.feedbackAvailability === "open" || vm.canWithdrawFeedbackConsent;
  // Before the event day the pass is for reference; check-in leads only once it can be used.
  const checkInOpen = vm.checkedIn || isGuestCheckInOpen(session.eventDate);

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
          <GuestDashboardNotices vm={vm} />
          <GuestPassNav checkInOpen={checkInOpen} feedbackOpen={feedbackOpen} />
          {checkInOpen ? (
            <>
              <div id="check-in"><GuestCheckInPanel vm={vm} /></div>
              <div id="event-details"><GuestEventDetailsPanel session={session} /></div>
            </>
          ) : (
            <>
              <PrismNoticeBanner role="status" tone="info">Check-in opens on {formatPortalDate(session.eventDate)}. Keep this pass to show the registration team when you arrive.</PrismNoticeBanner>
              <div id="event-details"><GuestEventDetailsPanel session={session} /></div>
            </>
          )}
          {feedbackOpen ? <div id="feedback"><GuestFeedbackPanel vm={vm} /></div> : null}
        </div>
    </PrismGuestShell>
  );
}
