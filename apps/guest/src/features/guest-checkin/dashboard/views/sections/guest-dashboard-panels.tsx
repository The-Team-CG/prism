"use client";

import type { ChangeEvent, RefObject } from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  MessageCircleHeart,
  ShieldCheck,
  Star,
  TicketCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { PrismSectionPanel, PrismTextarea } from "@prism/ui";
import {
  checkInModeButtonClass,
  guestEventStagePresentation,
  humanizeToken,
} from "../../model/guest-dashboard-rules";
import type { useGuestDashboardViewModel } from "../../view-models/use-guest-dashboard-view-model";
import type { GuestSession } from "../../model/guest-dashboard-types";

type GuestDashboardVm = ReturnType<typeof useGuestDashboardViewModel>;

export function GuestCheckInPanel({ vm }: { vm: GuestDashboardVm }) {
  return (
    <PrismSectionPanel
      title="Registration check-in"
      icon={ClipboardCheck}
      description="Name or headcount check-in with consent. Camera QR scanning is gated until HTTPS and masterlist constraints pass."
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-1">
          <button
            type="button"
            disabled={vm.checkedIn}
            onClick={() => {
              vm.setCheckInMode("name_search");
              vm.setWalkIn(false);
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${checkInModeButtonClass(vm.checkInMode === "name_search")}`}
          >
            <ClipboardCheck className="mr-1.5 inline size-3.5" />
            Name-based
          </button>
          <button
            type="button"
            disabled={vm.checkedIn}
            onClick={() => {
              vm.setCheckInMode("headcount");
              vm.setWalkIn(false);
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${checkInModeButtonClass(vm.checkInMode === "headcount")}`}
          >
            <Users className="mr-1.5 inline size-3.5" />
            Headcount-only
          </button>
        </div>

        <CheckInModeHelp mode={vm.checkInMode} />
        <WalkInFlag vm={vm} />
        <CheckInConsent vm={vm} />
        <WalkInWarning vm={vm} />

        <Button
          disabled={vm.busy === "check-in" || vm.checkedIn || !vm.checkInConsentAccepted}
          onClick={() => void vm.checkIn()}
          className="h-14 rounded-md px-5 font-bold sm:w-fit"
        >
          <TicketCheck className="size-4" />
          {vm.checkInButtonLabel}
        </Button>
      </div>
    </PrismSectionPanel>
  );
}

function CheckInModeHelp({ mode }: { mode: GuestDashboardVm["checkInMode"] }) {
  if (mode === "name_search") {
    return (
      <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
        <p className="font-bold text-foreground">Name-based check-in</p>
        <p className="mt-0.5 leading-6 text-muted-foreground">
          This browser-based check-in records guest name, check-in
          mode, consent version, and attendance time for PMCM
          registration review.
        </p>
      </div>
    );
  }
  if (mode === "headcount") {
    return (
      <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
        <p className="font-bold text-foreground">Headcount-only check-in</p>
        <p className="mt-0.5 leading-6 text-muted-foreground">
          Records one attendance count for this event without
          capturing a guest name. Use for small informal events.
        </p>
      </div>
    );
  }
  return null;
}

function WalkInFlag({ vm }: { vm: GuestDashboardVm }) {
  if (vm.checkInMode !== "name_search") return null;
  return (
    <label className="flex cursor-pointer items-center gap-3 border-l border-border px-3 py-2.5 text-sm font-semibold">
      <input
        type="checkbox"
        checked={vm.walkIn}
        onChange={(ev) => vm.setWalkIn(ev.target.checked)}
        className="size-4 accent-(--prism-amber)"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-foreground">Flag as walk-in for PMCM verification</span>
        <span className="text-xs font-medium leading-5 text-muted-foreground">
          Use this only when the guest is not on the registration
          list or needs operator approval.
        </span>
      </span>
    </label>
  );
}

function CheckInConsent({ vm }: { vm: GuestDashboardVm }) {
  const headcount = vm.checkInMode === "headcount";
  return (
    <label className="flex cursor-pointer items-start gap-3 border-l border-border bg-background/60 px-3 py-2.5 text-sm leading-5 text-muted-foreground">
      <input
        type="checkbox"
        checked={vm.checkInConsentAccepted}
        onChange={(ev) => vm.setCheckInConsentAccepted(ev.target.checked)}
        className="mt-0.5 size-4 accent-(--prism-amber)"
      />
      <span>
        {headcount
          ? "I consent to this attendance being recorded for event headcount."
          : "I consent to PMCM recording my name, check-in mode, attendance time, and this privacy notice version for registration and walk-in review."}
      </span>
    </label>
  );
}

function WalkInWarning({ vm }: { vm: GuestDashboardVm }) {
  if (!vm.walkIn || vm.checkInMode !== "name_search") return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-(--prism-amber)/25 bg-(--prism-amber)/8 p-3 text-sm leading-6 text-(--prism-amber)">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <span>
        Walk-ins are recorded as flagged first. PMCM or the
        event-day operator verifies authorization before treating the
        entry as cleared.
      </span>
    </div>
  );
}

export function GuestEventDetailsPanel({
  session,
  checkedIn,
  feedbackSubmitted,
}: {
  session: GuestSession;
  checkedIn: boolean;
  feedbackSubmitted: boolean;
}) {
  const stages = [
    ["Planning", "completed"],
    ["Event day", checkedIn ? "completed" : "current"],
    ["Done", feedbackSubmitted ? "completed" : "pending"],
  ] as const;

  return (
    <PrismSectionPanel
      title="Event details"
      icon={ClipboardCheck}
      description="Guest-safe event information for arrival, access, and current event-day state."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Event", session.eventName],
            ["Date", session.eventDate],
            ["Client", session.clientName],
            ["Access code", session.guestAccessCode],
            ["Readiness", humanizeToken(session.readiness)],
            ["Floorplan", humanizeToken(session.floorPlanStatus)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="border-l border-border bg-background/60 px-3 py-2.5">
            <p className="text-xs font-bold text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-black text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {stages.map(([label, state]) => {
          const presentation = guestEventStagePresentation(state);
          return (
            <div key={label} className={`border-l px-3 py-2 text-sm ${presentation.className}`}>
              <p className="font-black text-foreground">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{presentation.label}</p>
            </div>
          );
        })}
      </div>
    </PrismSectionPanel>
  );
}

function FeedbackMediaPicker({
  label,
  file,
  error,
  inputRef,
  accept,
  icon: Icon,
  chooseLabel,
  onSelect,
  onClear,
  formatFileSize,
}: {
  label: string;
  file: File | null;
  error?: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  icon: typeof ImagePlus;
  chooseLabel: string;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  formatFileSize: (bytes: number) => string;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input ref={inputRef} type="file" accept={accept} onChange={onSelect} className="hidden" />
      {file ? (
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
            <button type="button" onClick={onClear} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
          {error ? <p className="text-xs text-(--prism-signal)">{error}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-10 items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Icon className="size-4" />
          {chooseLabel}
        </button>
      )}
    </div>
  );
}

export function GuestFeedbackPanel({ vm }: { vm: GuestDashboardVm }) {
  return (
    <PrismSectionPanel
      title="Moderated feedback"
      icon={MessageCircleHeart}
      description="Feedback is saved for PMCM review and is never published automatically."
    >
      <form onSubmit={(ev) => void vm.submitFeedback(ev)} className="flex flex-col gap-3">
        <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
          <p className="font-bold text-foreground">Moderation state</p>
          <p className="mt-0.5 leading-6 text-muted-foreground">
            Submissions enter PMCM review. Nothing becomes public,
            client-facing, or testimonial content automatically.
          </p>
        </div>

        <div className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Rating</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Feedback rating">
            {[1, 2, 3, 4, 5].map((rating) => {
              const active = rating <= Number(vm.feedbackRating);
              return (
                <button
                  key={rating}
                  type="button"
                  role="radio"
                  aria-checked={Number(vm.feedbackRating) === rating}
                  onClick={() => {
                    vm.setFeedbackRating(String(rating));
                  }}
                  className="grid size-11 place-items-center rounded-md border border-border bg-background text-(--prism-amber) transition hover:border-(--prism-amber)/40 hover:bg-(--prism-amber)/8"
                >
                  <Star className={active ? "size-5 fill-(--prism-amber)" : "size-5"} />
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            <span>Comment</span>
            <span>{vm.feedbackComment.length}/500</span>
          </span>
          <PrismTextarea
            value={vm.feedbackComment}
            maxLength={500}
            onChange={(ev) => {
              vm.setFeedbackComment(ev.target.value);
            }}
            placeholder="Share feedback for PMCM moderation"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Photo and video stay optional metadata. Binary storage is gated; PMCM reviews text feedback first.
          </p>
          <FeedbackMediaPicker
            label="Photo (optional)"
            file={vm.photoFile}
            inputRef={vm.photoInputRef}
            accept="image/jpeg,image/png,application/pdf"
            icon={ImagePlus}
            chooseLabel="Choose photo"
            onSelect={vm.handlePhotoSelect}
            onClear={() => {
              vm.clearPhoto();
            }}
            formatFileSize={vm.formatFileSize}
          />
          <FeedbackMediaPicker
            label="Video (optional, max 60s)"
            file={vm.videoFile}
            error={vm.videoDurationError}
            inputRef={vm.videoInputRef}
            accept="video/mp4"
            icon={Video}
            chooseLabel="Choose video"
            onSelect={vm.handleVideoSelect}
            onClear={() => {
              vm.clearVideo();
            }}
            formatFileSize={vm.formatFileSize}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
          <input
            type="checkbox"
            checked={vm.feedbackConsentAccepted}
            onChange={(ev) => vm.setFeedbackConsentAccepted(ev.target.checked)}
            className="mt-0.5 size-4 accent-(--prism-amber)"
          />
          <span>
            I consent to PMCM saving my name, rating, comment, consent
            version, and moderation status for post-event review. It will
            not be published automatically.
          </span>
        </label>

        <Button
          disabled={vm.busy === "feedback" || !vm.feedbackConsentAccepted}
          className="h-12 rounded-md px-5 font-bold sm:w-fit"
          type="submit"
        >
          <MessageCircleHeart className="size-4" /> Send to PMCM
          moderation
        </Button>

        {vm.feedbackSubmitted ? (
          <div className="flex items-start gap-2 rounded-lg border border-(--prism-success)/20 bg-(--prism-success)/8 p-3 text-sm leading-6 text-(--prism-success)">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>
              Feedback submitted for moderation. PMCM will review before
              any post-event reuse.
            </span>
          </div>
        ) : null}
      </form>
    </PrismSectionPanel>
  );
}
