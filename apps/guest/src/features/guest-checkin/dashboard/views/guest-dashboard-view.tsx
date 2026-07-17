"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  LogOut,
  MessageCircleHeart,
  QrCode,
  ScanLine,
  ShieldCheck,
  Star,
  TicketCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { PrismSectionPanel, PrismNoticeBanner, PrismTextarea } from "@prism/ui";
import { humanizeToken } from "../model/guest-dashboard-rules";
import { useGuestDashboardViewModel } from "../view-models/use-guest-dashboard-view-model";

export function GuestDashboardView() {
  const vm = useGuestDashboardViewModel();
  const session = vm.session;

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
          <p className="text-sm text-muted-foreground">
            Loading event pass…
          </p>
        </div>
      </main>
    );
  }

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
              <QrCode className="size-16 text-sidebar-foreground/40" />
              <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-sidebar-foreground/50">
                Show at registration
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
          {vm.error && <PrismNoticeBanner tone="danger">{vm.error}</PrismNoticeBanner>}
          {vm.notice && (
            <PrismNoticeBanner tone="success">{vm.notice}</PrismNoticeBanner>
          )}

          <PrismSectionPanel
            title="Registration check-in"
            icon={ScanLine}
            description="Records this guest against the event code. Walk-ins are visible to PMCM for moderation."
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
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${
                    vm.checkInMode === "name_search"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ScanLine className="mr-1.5 inline size-3.5" />
                  Name-based
                </button>
                <button
                  type="button"
                  disabled={vm.checkedIn}
                  onClick={() => {
                    vm.setCheckInMode("headcount");
                    vm.setWalkIn(false);
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${
                    vm.checkInMode === "headcount"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="mr-1.5 inline size-3.5" />
                  Headcount-only
                </button>
              </div>

              {vm.checkInMode === "name_search" && (
                <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
                  <p className="font-bold text-foreground">
                    Name-based check-in
                  </p>
                  <p className="mt-0.5 leading-6 text-muted-foreground">
                    This browser-based check-in records guest name, check-in
                    mode, consent version, and attendance time for PMCM
                    registration review.
                  </p>
                </div>
              )}

              {vm.checkInMode === "headcount" && (
                <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
                  <p className="font-bold text-foreground">
                    Headcount-only check-in
                  </p>
                  <p className="mt-0.5 leading-6 text-muted-foreground">
                    Records one attendance count for this event without
                    capturing a guest name. Use for small informal events.
                  </p>
                </div>
              )}

              {vm.checkInMode === "name_search" && (
                <label className="flex cursor-pointer items-center gap-3 border-l border-border px-3 py-2.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={vm.walkIn}
                    onChange={(ev) => vm.setWalkIn(ev.target.checked)}
                    className="size-4 accent-(--prism-amber)"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-foreground">
                      Flag as walk-in for PMCM verification
                    </span>
                    <span className="text-xs font-medium leading-5 text-muted-foreground">
                      Use this only when the guest is not on the registration
                      list or needs operator approval.
                    </span>
                  </span>
                </label>
              )}

              <label className="flex cursor-pointer items-start gap-3 border-l border-border bg-background/60 px-3 py-2.5 text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={vm.checkInConsentAccepted}
                  onChange={(ev) => vm.setCheckInConsentAccepted(ev.target.checked)}
                  className="mt-0.5 size-4 accent-(--prism-amber)"
                />
                <span>
                  {vm.checkInMode === "headcount"
                    ? "I consent to this attendance being recorded for event headcount."
                    : "I consent to PMCM recording my name, check-in mode, attendance time, and this privacy notice version for registration and walk-in review."}
                </span>
              </label>

              {vm.walkIn && vm.checkInMode === "name_search" && (
                <div className="flex items-start gap-2 rounded-lg border border-(--prism-amber)/25 bg-(--prism-amber)/8 p-3 text-sm leading-6 text-(--prism-amber)">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Walk-ins are recorded as flagged first. PMCM or the
                    event-day operator verifies authorization before treating the
                    entry as cleared.
                  </span>
                </div>
              )}

              <Button
                disabled={
                  vm.busy === "check-in" || vm.checkedIn || !vm.checkInConsentAccepted
                }
                onClick={() => void vm.checkIn()}
                className="h-14 rounded-md px-5 font-bold sm:w-fit"
              >
                <TicketCheck className="size-4" />
                {vm.checkInButtonLabel}
              </Button>
            </div>
          </PrismSectionPanel>

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
                  [
                    "Floorplan",
                    humanizeToken(session.floorPlanStatus),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="border-l border-border bg-background/60 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-black text-foreground">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["Planning", "completed"],
                  ["Event day", vm.checkedIn ? "completed" : "current"],
                  ["Done", vm.feedbackSubmitted ? "completed" : "pending"],
                ] as const
              ).map(([label, state]) => (
                <div
                  key={label}
                  className={`border-l px-3 py-2 text-sm ${
                    state === "completed"
                      ? "border-l-(--prism-sage) bg-(--prism-sage)/10"
                      : state === "current"
                        ? "border-l-(--prism-signal) bg-(--prism-signal)/8"
                        : "border-l-border bg-background/60"
                  }`}
                >
                  <p className="font-black text-foreground">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state === "completed"
                      ? "Complete"
                      : state === "current"
                        ? "Current step"
                        : "Pending"}
                  </p>
                </div>
              ))}
            </div>
          </PrismSectionPanel>

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
                <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Rating
                </span>
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
                        <Star
                          className={
                            active
                              ? "size-5 fill-(--prism-amber)"
                              : "size-5"
                          }
                        />
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
                <div className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Photo (optional)
                  </span>
                  <input
                    ref={vm.photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={vm.handlePhotoSelect}
                    className="hidden"
                  />
                  {vm.photoFile ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                      <ImagePlus className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {vm.photoFile.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {vm.formatFileSize(vm.photoFile.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          vm.clearPhoto();
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => vm.photoInputRef.current?.click()}
                      className="flex h-10 items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    >
                      <ImagePlus className="size-4" />
                      Choose photo
                    </button>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Video (optional, max 60s)
                  </span>
                  <input
                    ref={vm.videoInputRef}
                    type="file"
                    accept="video/mp4"
                    onChange={vm.handleVideoSelect}
                    className="hidden"
                  />
                  {vm.videoFile ? (
                    <div className="grid gap-1.5">
                      <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                        <Video className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {vm.videoFile.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {vm.formatFileSize(vm.videoFile.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            vm.clearVideo();
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {vm.videoDurationError && (
                        <p className="text-xs text-(--prism-signal)">
                          {vm.videoDurationError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => vm.videoInputRef.current?.click()}
                      className="flex h-10 items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    >
                      <Video className="size-4" />
                      Choose video
                    </button>
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={vm.feedbackConsentAccepted}
                  onChange={(ev) =>
                    vm.setFeedbackConsentAccepted(ev.target.checked)
                  }
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

              {vm.feedbackSubmitted && (
                <div className="flex items-start gap-2 rounded-lg border border-(--prism-success)/20 bg-(--prism-success)/8 p-3 text-sm leading-6 text-(--prism-success)">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Feedback submitted for moderation. PMCM will review before
                    any post-event reuse.
                  </span>
                </div>
              )}
            </form>
          </PrismSectionPanel>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">
                Current readiness
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {humanizeToken(session.readiness)}
              </p>
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
