"use client";

import { CheckCircle2, ClipboardCheck, MessageCircleHeart, Star, TicketCheck, Users } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import type { PrismGuestSession } from "@prism/types";
import { PrismSectionPanel } from "@prism/ui";
import { Textarea } from "@prism/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@prism/ui/components/toggle-group";
import { guestPassDetails } from "../../model/guest-dashboard-rules";
import type { CheckInMode } from "../../model/guest-dashboard-types";
import type { useGuestDashboardViewModel } from "../../view-models/use-guest-dashboard-view-model";

type GuestDashboardVm = ReturnType<typeof useGuestDashboardViewModel>;

const CHECK_IN_MODES: readonly CheckInMode[] = ["name_search", "headcount"];

function GuestCheckInSubmit({ vm }: { vm: GuestDashboardVm }) {
  const showGuidance = !vm.canCheckIn && !vm.busy;
  const guidance = vm.checkInMode === "name_search" && !vm.checkInGuestName.trim()
    ? "Enter the name on the event list and confirm your consent."
    : "Confirm your consent to send your check-in request.";
  return (
    <>
      {showGuidance ? <p id="check-in-guidance" className="text-sm text-muted-foreground">{guidance}</p> : null}
      <Button aria-describedby={showGuidance ? "check-in-guidance" : undefined} disabled={!vm.canCheckIn} onClick={() => void vm.checkIn()} className="h-12 sm:w-fit">
        <TicketCheck className="size-4" /> {vm.checkInButtonLabel}
      </Button>
    </>
  );
}

export function GuestCheckInPanel({ vm }: { vm: GuestDashboardVm }) {
  if (vm.checkedIn) {
    return (
      <PrismSectionPanel title="Check-in request received" icon={TicketCheck} description="Your request was sent successfully.">
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          The registration team can confirm your attendance. A name match may need review; sending this request does not guarantee admission.
        </p>
        <a href="#event-details" className="mt-3 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary">
          Show event details to registration
        </a>
      </PrismSectionPanel>
    );
  }
  return (
    <PrismSectionPanel title="Check in" icon={ClipboardCheck} description="Choose how to record your attendance. Ask the registration team if you need help.">
      <div className="flex flex-col gap-4">
        {/* A two-way choice is a single-select group, so the only check-in button on the page is the one that submits. */}
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Check-in method"
          value={vm.checkInMode}
          disabled={vm.checkedIn}
          onValueChange={(value) => {
            const mode = CHECK_IN_MODES.find((item) => item === value);
            if (mode) vm.setCheckInMode(mode);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="name_search" className="min-h-11 flex-1 gap-1.5 px-3 text-sm font-semibold">
            <ClipboardCheck className="size-4" aria-hidden="true" />
            Check in with my name
          </ToggleGroupItem>
          <ToggleGroupItem value="headcount" className="min-h-11 flex-1 gap-1.5 px-3 text-sm font-semibold">
            <Users className="size-4" aria-hidden="true" />
            Check in without my name
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm leading-6 text-muted-foreground">
          {vm.checkInMode === "name_search"
            ? "Enter the name on the event list. The registration team may need to review a match."
            : "Counts you as one attendee without recording your name. It is not a group headcount and does not confirm admission."}
        </p>
        {vm.checkInMode === "name_search" ? (
          <label htmlFor="guest-check-in-name" className="grid gap-1.5 text-sm font-semibold">
            Guest name
            <Input id="guest-check-in-name" className="h-11" value={vm.checkInGuestName} onChange={(event) => vm.setCheckInGuestName(event.target.value)} autoComplete="name" placeholder="Name at registration" />
          </label>
        ) : null}
        <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
          <input type="checkbox" checked={vm.checkInConsentAccepted} onChange={(event) => vm.setCheckInConsentAccepted(event.target.checked)} className="mt-1 size-4 accent-attention" />
          <span>{vm.checkInMode === "headcount"
            ? "I consent to this attendance being recorded for the event headcount."
            : "I consent to PMCM recording my name and check-in time for event registration."}</span>
        </label>
        <GuestCheckInSubmit vm={vm} />
      </div>
    </PrismSectionPanel>
  );
}

export function GuestEventDetailsPanel({ session }: { session: PrismGuestSession }) {
  const description = session.venue
    ? "Show this to the registration team when you arrive."
    : "Show this to the registration team when you arrive. They can give you venue and arrival directions.";
  return (
    <PrismSectionPanel title="Your event" icon={ClipboardCheck} description={description}>
      <dl className="grid gap-4 sm:grid-cols-2">
        {guestPassDetails(session).map(([title, value]) => (
          <div key={title}>
            <dt className="text-sm text-muted-foreground">{title}</dt>
            <dd className={`mt-1 break-words text-sm font-semibold text-foreground ${title === "Access code" ? "font-mono" : ""}`}>{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </PrismSectionPanel>
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
