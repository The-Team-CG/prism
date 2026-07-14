"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  KeyRound,
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
import { Input } from "@/app/components/ui/input";
import { PrismSectionPanel, PrismNoticeBanner, PrismTextarea } from "@prism/ui";
import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  savePrismSession,
  type PrismGuestEventPass,
} from "@prism/types";

type GuestSession = PrismGuestEventPass & {
  guestName: string;
  openedAt: string;
};

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE =
  "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";
const PRIVACY_NOTICE_VERSION = "2026-05-01";
const POLL_INTERVAL_MS = 20_000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_DURATION_S = 60;

function readSession() {
  return readPrismSession<GuestSession>(SESSION_KEY);
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return body.data as T;
}

function guestPath(session: GuestSession, suffix = "") {
  return `/api/guest/events/${encodeURIComponent(session.guestAccessCode)}${suffix}`;
}

export default function GuestDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<GuestSession | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [checkInConsentAccepted, setCheckInConsentAccepted] = useState(false);
  const [checkInMode, setCheckInMode] = useState<"name_search" | "headcount">(
    "name_search",
  );
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackConsentAccepted, setFeedbackConsentAccepted] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDurationError, setVideoDurationError] = useState<string | null>(
    null,
  );

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/open?next=/dashboard");
      return;
    }
    setSession(current);
  }, [router]);

  const refreshEvent = useCallback(
    async (current = session) => {
      if (!current) return;
      try {
        const event = await apiFetch<PrismGuestEventPass>(guestPath(current));
        const next = { ...current, ...event };
        setSession(next);
        savePrismSession(SESSION_KEY, next);
      } catch {
        // Silently ignore poll errors — stale data is acceptable
      }
    },
    [session],
  );

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => refreshEvent(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session, refreshEvent]);

  async function checkIn() {
    if (!session) return;
    setBusy("check-in");
    setError(null);
    setNotice(null);
    try {
      await apiFetch(guestPath(session, "/check-ins"), {
        method: "POST",
        body: JSON.stringify({
          guestName:
            checkInMode === "headcount" ? "Walk-in guest" : session.guestName,
          checkInMode,
          walkIn: checkInMode === "headcount" ? false : walkIn,
          verificationStatus:
            checkInMode === "headcount"
              ? "verified"
              : walkIn
                ? "flagged"
                : "verified",
          privacyConsentAccepted: checkInConsentAccepted,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          marketingConsentAccepted: false,
        }),
      });
      setCheckedIn(true);
      if (checkInMode === "headcount") {
        setNotice("Attendance recorded.");
      } else if (walkIn) {
        setNotice("Walk-in flagged for PMCM review.");
      } else {
        setNotice("Check-in successful.");
      }
      await refreshEvent();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function submitFeedback(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!session) return;
    setBusy("feedback");
    setError(null);
    setNotice(null);

    if (videoFile) {
      try {
        const duration = await checkVideoDuration(videoFile);
        if (duration > MAX_VIDEO_DURATION_S) {
          setVideoDurationError(
            `Video must be ${MAX_VIDEO_DURATION_S} seconds or shorter.`,
          );
          setBusy(null);
          return;
        }
      } catch {
        // If we can't check duration, allow submission
      }
    }

    try {
      const payload: Record<string, unknown> = {
        guestName: session.guestName,
        rating: Number(feedbackRating),
        comment: feedbackComment,
        privacyConsentAccepted: feedbackConsentAccepted,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        marketingConsentAccepted: false,
      };

      if (photoFile) {
        payload.photo = {
          fileName: photoFile.name,
          mimeType: photoFile.type,
          sizeBytes: photoFile.size,
        };
      }
      if (videoFile) {
        payload.video = {
          fileName: videoFile.name,
          mimeType: videoFile.type,
          sizeBytes: videoFile.size,
        };
      }

      await apiFetch(guestPath(session, "/feedback"), {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFeedbackSubmitted(true);
      setNotice("Feedback submitted for moderation.");
      setFeedbackComment("");
      setPhotoFile(null);
      setVideoFile(null);
      setVideoDurationError(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  function checkVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => reject(new Error("Unable to read video."));
      video.src = URL.createObjectURL(file);
    });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Photo must be 10 MB or smaller.");
      return;
    }
    setPhotoFile(file);
    setError(null);
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Video must be 10 MB or smaller.");
      return;
    }
    setVideoFile(file);
    setVideoDurationError(null);
    setError(null);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

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

  const leaveEvent = () => {
    clearPrismSession(SESSION_KEY);
    router.replace("/open");
  };

  const attendanceState = checkedIn
    ? walkIn
      ? "Flagged walk-in"
      : "Recorded"
    : "Pending";
  const checkInButtonLabel = checkedIn
    ? "Attendance recorded"
    : checkInMode === "headcount"
      ? "Record attendance"
      : walkIn
        ? "Submit walk-in for verification"
        : "Record name check-in";
  const feedbackState = feedbackSubmitted
    ? "Pending review"
    : feedbackConsentAccepted
      ? "Consent ready"
      : "Consent needed";

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
          {error && <PrismNoticeBanner tone="danger">{error}</PrismNoticeBanner>}
          {notice && (
            <PrismNoticeBanner tone="success">{notice}</PrismNoticeBanner>
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
                  disabled={checkedIn}
                  onClick={() => {
                    setCheckInMode("name_search");
                    setWalkIn(false);
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${
                    checkInMode === "name_search"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ScanLine className="mr-1.5 inline size-3.5" />
                  Name-based
                </button>
                <button
                  type="button"
                  disabled={checkedIn}
                  onClick={() => {
                    setCheckInMode("headcount");
                    setWalkIn(false);
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${
                    checkInMode === "headcount"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="mr-1.5 inline size-3.5" />
                  Headcount-only
                </button>
              </div>

              {checkInMode === "name_search" && (
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

              {checkInMode === "headcount" && (
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

              {checkInMode === "name_search" && (
                <label className="flex cursor-pointer items-center gap-3 border-l border-border px-3 py-2.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={walkIn}
                    onChange={(ev) => setWalkIn(ev.target.checked)}
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
                  checked={checkInConsentAccepted}
                  onChange={(ev) => setCheckInConsentAccepted(ev.target.checked)}
                  className="mt-0.5 size-4 accent-(--prism-amber)"
                />
                <span>
                  {checkInMode === "headcount"
                    ? "I consent to this attendance being recorded for event headcount."
                    : "I consent to PMCM recording my name, check-in mode, attendance time, and this privacy notice version for registration and walk-in review."}
                </span>
              </label>

              {walkIn && checkInMode === "name_search" && (
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
                  busy === "check-in" || checkedIn || !checkInConsentAccepted
                }
                onClick={checkIn}
                className="h-14 rounded-md px-5 font-bold sm:w-fit"
              >
                <TicketCheck className="size-4" />
                {checkInButtonLabel}
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
                  ["Readiness", session.readiness.replaceAll("_", " ")],
                  [
                    "Floorplan",
                    session.floorPlanStatus.replaceAll("_", " "),
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
                  ["Event day", checkedIn ? "completed" : "current"],
                  ["Done", feedbackSubmitted ? "completed" : "pending"],
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
            <form onSubmit={submitFeedback} className="flex flex-col gap-3">
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
                    const active = rating <= Number(feedbackRating);
                    return (
                      <button
                        key={rating}
                        type="button"
                        role="radio"
                        aria-checked={Number(feedbackRating) === rating}
                        onClick={() => {
                          setFeedbackRating(String(rating));
                          setFeedbackSubmitted(false);
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
                  <span>{feedbackComment.length}/500</span>
                </span>
                <PrismTextarea
                  value={feedbackComment}
                  maxLength={500}
                  onChange={(ev) => {
                    setFeedbackComment(ev.target.value);
                    setFeedbackSubmitted(false);
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
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  {photoFile ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                      <ImagePlus className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {photoFile.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(photoFile.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          if (photoInputRef.current)
                            photoInputRef.current.value = "";
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
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
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  {videoFile ? (
                    <div className="grid gap-1.5">
                      <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
                        <Video className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {videoFile.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(videoFile.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setVideoFile(null);
                            setVideoDurationError(null);
                            if (videoInputRef.current)
                              videoInputRef.current.value = "";
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {videoDurationError && (
                        <p className="text-xs text-(--prism-signal)">
                          {videoDurationError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
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
                  checked={feedbackConsentAccepted}
                  onChange={(ev) =>
                    setFeedbackConsentAccepted(ev.target.checked)
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
                disabled={busy === "feedback" || !feedbackConsentAccepted}
                className="h-12 rounded-md px-5 font-bold sm:w-fit"
                type="submit"
              >
                <MessageCircleHeart className="size-4" /> Send to PMCM
                moderation
              </Button>

              {feedbackSubmitted && (
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
                {session.readiness.replaceAll("_", " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={leaveEvent}
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
