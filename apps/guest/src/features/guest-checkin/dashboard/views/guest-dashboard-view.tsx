"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismGuestShell, PrismNoticeBanner } from "@prism/ui";
import { portalHref } from "@prism/ui/portal-path";
import { useGuestDashboardViewModel } from "../view-models/use-guest-dashboard-view-model";
import { isGuestCheckInOpen } from "../model/guest-dashboard-rules";
import { LoadingState } from "@prism/ui/components/loading-state";
import {
  GuestCheckInPanel,
  GuestPassCard,
  GuestFeedbackPanel,
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

function GuestPassNav({ checkInOpen, feedbackOpen }: { checkInOpen: boolean; feedbackOpen: boolean }) {
  const [selected, setSelected] = useState(checkInOpen ? "#check-in" : "#event-details");
  const sections = [
    ...(checkInOpen ? [{ href: "#check-in", label: "Check in" }] : []),
    { href: "#event-details", label: "Your pass" },
    { href: portalHref("/games/join"), label: "Join a game" },
    ...(feedbackOpen ? [{ href: "#feedback", label: "Feedback" }] : []),
  ];
  return (
    <nav aria-label="Guest pass sections" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {sections.map((section) => <a key={section.href} href={section.href} onClick={() => setSelected(section.href)} aria-current={selected === section.href ? "location" : undefined} className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${selected === section.href ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{section.label}</a>)}
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
      lead={<GuestPassCard session={session} checkedIn={vm.checkedIn} />}
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
            <div id="check-in"><GuestCheckInPanel vm={vm} /></div>
          ) : (
            <PrismNoticeBanner role="status" tone="info">Check-in opens on {formatPortalDate(session.eventDate)}. Keep this pass to show the registration team when you arrive.</PrismNoticeBanner>
          )}
          {feedbackOpen ? <div id="feedback"><GuestFeedbackPanel vm={vm} /></div> : null}
        </div>
    </PrismGuestShell>
  );
}
