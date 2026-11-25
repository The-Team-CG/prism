"use client";

import { LogOut } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismGuestShell, PrismNoticeBanner } from "@prism/ui";
import { LoadingState } from "@prism/ui/components/loading-state";
import { guestGamesHref, guestTabs } from "@/features/guest-shared/guest-tabs";
import { useGuestDashboardViewModel } from "../view-models/use-guest-dashboard-view-model";
import { guestPassMoment, type GuestPassMoment } from "../model/guest-dashboard-rules";
import type { PrismGuestSession } from "@prism/types";
import {
  GuestCheckInCard,
  GuestCheckInStatus,
  GuestFeedbackPanel,
  GuestPassLinkRow,
  GuestPassQuickActions,
  GuestPassTicket,
} from "./sections/guest-dashboard-panels";

function GuestDashboardLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
        <LoadingState label="Loading event pass…" />
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

/** What follows the ticket: the invitation's next steps before the day, check-in on the day, then the games. */
function GuestPassMomentBody({ session, moment }: { session: PrismGuestSession; moment: GuestPassMoment }) {
  const gamesHref = guestGamesHref(session);
  if (moment === "before") {
    return (
      <>
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm leading-5 text-muted-foreground">
          Check-in opens on {formatPortalDate(session.eventDate)}. Come back to this pass then, or show it at the door.
        </p>
        {session.gamesLobbySlug ? <GuestPassLinkRow href={gamesHref} title="Play while you wait" detail="See activities from your host" /> : null}
      </>
    );
  }
  if (moment === "after") {
    // Feedback, when it is open, leads above; once it has closed the pass still says the event is over.
    return session.feedbackAvailability === "open" ? null : (
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm leading-5 text-muted-foreground">This event has ended. Thank you for coming.</p>
    );
  }
  return <GuestPassLinkRow href={gamesHref} title={session.gamesLobbySlug ? "Open activities" : "Join with PIN"} detail="Join the host or return to your game" />;
}

function primaryPassAction(vm: GuestDashboardVm, moment: GuestPassMoment) {
  if (moment === "today" && !vm.checkedIn) return <GuestCheckInCard vm={vm} />;
  if (moment === "after" && (vm.session?.feedbackAvailability === "open" || vm.canWithdrawFeedbackConsent)) {
    return <div id="feedback"><GuestFeedbackPanel vm={vm} /></div>;
  }
  return null;
}

/**
 * The guest's pass, arranged by where they are in the event: before the day it is the invitation, on the day check-in
 * leads, and after the event feedback does. Games are one tap away throughout.
 */
export function GuestDashboardView() {
  const vm = useGuestDashboardViewModel();
  const session = vm.session;

  if (!session) return <GuestDashboardLoading />;
  const moment = guestPassMoment(session);
  const primaryAction = primaryPassAction(vm, moment);
  const ticket = <GuestPassTicket session={session} moment={moment} />;

  return (
    <PrismGuestShell
      eventName={session.eventName}
      tabs={guestTabs(session, "pass")}
      layout="split"
      lead={
        <div className="grid gap-3">
          <GuestDashboardNotices vm={vm} />
          {moment === "today" && vm.checkedIn ? <GuestCheckInStatus session={session} /> : null}
          {primaryAction ?? ticket}
          {moment !== "after" ? <GuestPassQuickActions session={session} /> : null}
        </div>
      }
      actions={
        // On a phone it is an icon where the other portals keep the account menu; wider screens spell it out.
        <button
          type="button"
          onClick={() => vm.leave()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:rounded-md md:px-2"
        >
          <LogOut aria-hidden="true" className="size-5 md:size-4" />
          <span className="max-md:sr-only">Leave</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {primaryAction ? ticket : <GuestPassMomentBody session={session} moment={moment} />}
      </div>
    </PrismGuestShell>
  );
}
