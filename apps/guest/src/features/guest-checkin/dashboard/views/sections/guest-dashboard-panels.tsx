"use client";

import { CalendarPlus, Check, CheckCircle2, ChevronRight, Gamepad2, MapPin, MessageCircleHeart, Star } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import type { PrismGuestSession } from "@prism/types";
import { PrismSectionPanel } from "@prism/ui";
import { formatPortalTime } from "@prism/ui/format-date";
import { Textarea } from "@prism/ui/components/textarea";
import {
  formatArrivalTime,
  formatPassDate,
  guestCalendarFile,
  guestCountdownLabel,
  type GuestPassMoment,
  venueDirectionsUrl,
} from "../../model/guest-dashboard-rules";
import type { useGuestDashboardViewModel } from "../../view-models/use-guest-dashboard-view-model";

type GuestDashboardVm = ReturnType<typeof useGuestDashboardViewModel>;

/**
 * The pass itself, a dark ticket that carries the page title. Before the day it answers when and where, and how long
 * to go; on the day it shrinks to one line so check-in can lead.
 */
export function GuestPassTicket({ session, moment }: { session: PrismGuestSession; moment: GuestPassMoment }) {
  const startTime = formatArrivalTime(session.startTime);
  if (moment !== "before") {
    const line = [moment === "today" ? "Today" : formatPassDate(session.eventDate), startTime, session.venue].filter(Boolean).join(" · ");
    return (
      <section id="event-details" aria-label="Your event pass" className="overflow-hidden rounded-2xl bg-ink text-ink-foreground">
        <div className="px-5 py-4 lg:py-5">
          <p className="text-sm text-ink-foreground/70">{line}</p>
          <h1 className="mt-0.5 font-heading text-xl font-semibold leading-tight lg:text-2xl">{session.eventName}</h1>
        </div>
        <p className="hidden border-t border-dashed border-ink-foreground/30 px-5 py-3.5 text-sm text-ink-foreground/80 lg:block">Hosted by {session.clientName}</p>
      </section>
    );
  }
  const countdown = guestCountdownLabel(session.eventDate);
  return (
    <section id="event-details" aria-label="Your event pass" className="overflow-hidden rounded-2xl bg-ink text-ink-foreground">
      <div className="px-5 pb-5 pt-5">
        <p className="text-sm text-ink-foreground/70">You&apos;re invited</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight">{session.eventName}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <dt className="sr-only">When</dt>
            <dd className="text-base font-semibold">{formatPassDate(session.eventDate)}</dd>
            <dd className="text-sm text-ink-foreground/70">{startTime ?? "Time to follow"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="sr-only">Where</dt>
            <dd className="break-words text-base font-semibold">{session.venue ?? "Venue to follow"}</dd>
            {session.venue ? null : <dd className="text-sm text-ink-foreground/70">Registration can tell you</dd>}
          </div>
        </dl>
      </div>
      <div className="relative flex items-center justify-between gap-3 border-t border-dashed border-ink-foreground/30 px-5 py-3.5">
        {/* The two notches where a ticket tears. */}
        <span aria-hidden="true" className="absolute -left-3 -top-3 size-6 rounded-full bg-background" />
        <span aria-hidden="true" className="absolute -right-3 -top-3 size-6 rounded-full bg-background" />
        <p className="min-w-0 truncate text-sm text-ink-foreground/80">Hosted by {session.clientName}</p>
        {countdown ? <p className="shrink-0 rounded-full bg-ink-foreground/15 px-2.5 py-1 text-xs font-semibold">{countdown}</p> : null}
      </div>
    </section>
  );
}

function downloadCalendarFile(session: PrismGuestSession) {
  const url = URL.createObjectURL(new Blob([guestCalendarFile(session)], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${session.eventName.replace(/[^\w -]+/g, "").trim() || "event"}.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Directions when a venue is recorded, and the event in the guest's own calendar. */
export function GuestPassQuickActions({ session }: { session: PrismGuestSession }) {
  return (
    <div className={session.venue ? "grid grid-cols-2 gap-2" : "grid"}>
      {session.venue ? (
        <Button asChild variant="outline" className="h-11 bg-card">
          <a href={venueDirectionsUrl(session.venue)} target="_blank" rel="noreferrer"><MapPin className="size-4" aria-hidden="true" /> Directions</a>
        </Button>
      ) : null}
      <Button type="button" variant="outline" className="h-11 bg-card" onClick={() => downloadCalendarFile(session)}>
        <CalendarPlus className="size-4" aria-hidden="true" /> Add to calendar
      </Button>
    </div>
  );
}

/** A row that leads somewhere else in the pass, such as the games. */
export function GuestPassLinkRow({ href, title, detail, icon: Icon = Gamepad2 }: { href: string; title: string; detail: string; icon?: typeof Gamepad2 }) {
  return (
    <a href={href} className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </a>
  );
}

/** After the request went: one status, said once. The receipt cannot say more than "accepted", so neither does this. */
export function GuestCheckInStatus({ session }: { session: PrismGuestSession }) {
  const sentAt = session.checkInSentAt ? formatPortalTime(session.checkInSentAt, "") : "";
  return (
    <section role="status" aria-label="Check-in" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-card px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white"><Check className="size-5" strokeWidth={3} aria-hidden="true" /></span>
      <div className="min-w-0">
        <h2 className="font-semibold text-foreground">Check-in sent{sentAt ? ` at ${sentAt}` : ""}</h2>
        <p className="text-sm leading-5 text-muted-foreground">Registration confirms arrivals at the door. If they ask, show them this pass.</p>
      </div>
    </section>
  );
}

function CheckInConsent({ vm }: { vm: GuestDashboardVm }) {
  return (
    <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
      <input type="checkbox" checked={vm.checkInConsentAccepted} onChange={(event) => vm.setCheckInConsentAccepted(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
      <span>{vm.checkInMode === "headcount"
        ? "I consent to this attendance being recorded for the event headcount."
        : "I consent to PMCM recording my name and check-in time for event registration."}</span>
    </label>
  );
}

/** What is still missing, said under the button instead of leaving it disabled without a reason. */
function checkInGuidance(vm: GuestDashboardVm): string | null {
  if (vm.canCheckIn || vm.busy) return null;
  if (vm.checkInMode === "name_search" && !vm.checkInGuestName.trim()) return "Enter your name, then tick the consent.";
  return "Tick the consent to send your check-in.";
}

/**
 * On the day: one name field, the consent and one button. Checking in without a name is a quieter choice under it,
 * not a second tab, because most guests give their name.
 */
export function GuestCheckInCard({ vm }: { vm: GuestDashboardVm }) {
  const named = vm.checkInMode === "name_search";
  const guidance = checkInGuidance(vm);
  return (
    <section id="check-in" aria-labelledby="check-in-title" className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 id="check-in-title" className="font-heading text-lg font-semibold text-foreground">Check in</h2>
        <p className="text-sm text-muted-foreground">{named ? "Use the name on your invitation. Registration confirms it, and helps if it is not found." : "You are counted as one guest, without your name."}</p>
      </div>
      {named ? (
        <label htmlFor="guest-check-in-name" className="grid gap-1.5 text-sm font-semibold">
          Guest name
          <Input id="guest-check-in-name" className="h-12 text-base" value={vm.checkInGuestName} onChange={(event) => vm.setCheckInGuestName(event.target.value)} autoComplete="name" placeholder="Your name, as on the invitation" />
        </label>
      ) : null}
      <CheckInConsent vm={vm} />
      <div className="grid gap-2">
        <Button aria-describedby={guidance ? "check-in-guidance" : undefined} disabled={!vm.canCheckIn} onClick={() => void vm.checkIn()} className="h-12 w-full text-base">
          {vm.busy === "check-in" ? "Checking you in…" : "Check me in"}
        </Button>
        {guidance ? <p id="check-in-guidance" className="text-center text-sm text-muted-foreground">{guidance}</p> : null}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {named ? "Rather not give your name? " : "Want your name on the list? "}
        <button type="button" onClick={() => vm.setCheckInMode(named ? "headcount" : "name_search")} className="min-h-11 font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {named ? "Check in without it" : "Use my name"}
        </button>
      </p>
    </section>
  );
}

export function GuestFeedbackPanel({ vm }: { vm: GuestDashboardVm }) {
  return (
    <PrismSectionPanel title="Share feedback" icon={MessageCircleHeart} description="PMCM reviews your feedback before it can be shared.">
      {vm.session?.feedbackAvailability === "open" ? <form onSubmit={(event) => void vm.submitFeedback(event)} className="flex flex-col gap-4">
        <label className="grid gap-1.5 text-sm font-semibold">
          Your name
          <Input value={vm.feedbackGuestName} onChange={(event) => vm.setFeedbackGuestName(event.target.value)} autoComplete="name" placeholder="Your name" />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">Rating</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <label key={rating} className="grid size-11 cursor-pointer place-items-center rounded-md border border-border bg-background text-attention has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary">
                <input type="radio" name="rating" value={rating} checked={Number(vm.feedbackRating) === rating} onChange={() => vm.setFeedbackRating(String(rating))} aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`} className="sr-only" />
                <Star aria-hidden="true" className={rating <= Number(vm.feedbackRating) ? "size-5 fill-attention" : "size-5"} />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-1.5 text-sm font-semibold">
          <span className="flex justify-between gap-3"><span>Comment</span><span className="font-normal text-muted-foreground">{vm.feedbackComment.length}/500</span></span>
          <Textarea value={vm.feedbackComment} maxLength={500} onChange={(event) => vm.setFeedbackComment(event.target.value)} placeholder="Tell us about your experience" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Photo or video (optional)
          <input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" onChange={(event) => vm.setFeedbackMedia(event.target.files?.[0] ?? null)} className="text-sm font-normal text-foreground" />
          <span className="text-xs font-normal text-muted-foreground">JPEG, PNG, MP4 or MOV, up to 100 MB.</span>
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
          <input type="checkbox" checked={vm.feedbackConsentAccepted} onChange={(event) => vm.setFeedbackConsentAccepted(event.target.checked)} className="mt-1 size-4 accent-attention" />
          <span>I consent to PMCM saving my name, rating, comment and any photo or video for review. My feedback will not be published automatically.</span>
        </label>
        <Button disabled={!vm.canSubmitFeedback} className="h-12 sm:w-fit" type="submit"><MessageCircleHeart className="size-4" /> Send feedback</Button>
        {vm.feedbackSubmitted ? <p role="status" className="flex items-start gap-2 text-sm text-success"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Feedback sent. PMCM will review it before sharing.</p> : null}
      </form> : <p className="text-sm text-muted-foreground">The feedback submission window has closed.</p>}
      {vm.canWithdrawFeedbackConsent ? <div className="mt-4 border-t border-border pt-4"><p className="mb-2 text-sm text-muted-foreground">You can withdraw consent for the feedback submitted from this device.</p><Button type="button" variant="outline" disabled={Boolean(vm.busy)} onClick={() => void vm.withdrawFeedbackConsent()}>Withdraw feedback consent</Button></div> : null}
    </PrismSectionPanel>
  );
}
