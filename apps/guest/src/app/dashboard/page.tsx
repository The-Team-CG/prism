"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  LogOut,
  MessageCircleHeart,
  QrCode,
  ScanLine,
  ShieldCheck,
  Star,
  TicketCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  PrismDashboardShell,
  PrismMetricTile,
  PrismNoticeBanner,
  PrismSectionPanel,
  PrismStatusTimeline,
  PrismTextarea,
  RolePageHeader,
} from "@prism/ui";
import { PRISM_SESSION_STORAGE_KEYS, clearPrismSession, readPrismSession, savePrismSession, type PrismGuestEventPass } from "@prism/types";

type GuestSession = PrismGuestEventPass & {
  guestName: string;
  openedAt: string;
};

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";
const PRIVACY_NOTICE_VERSION = "2026-05-01";

function readSession() {
  return readPrismSession<GuestSession>(SESSION_KEY);
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
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
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackConsentAccepted, setFeedbackConsentAccepted] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/open?next=/dashboard");
      return;
    }
    setSession(current);
  }, [router]);

  async function refreshEvent(current = session) {
    if (!current) return;
    const event = await apiFetch<PrismGuestEventPass>(guestPath(current));
    const next = { ...current, ...event };
    setSession(next);
    savePrismSession(SESSION_KEY, next);
  }

  async function checkIn() {
    if (!session) return;
    setBusy("check-in");
    setError(null);
    setNotice(null);
    try {
      await apiFetch(guestPath(session, "/check-ins"), {
        method: "POST",
        body: JSON.stringify({
          guestName: session.guestName,
          checkInMode: walkIn ? "walk_in" : "name_search",
          walkIn,
          verificationStatus: walkIn ? "flagged" : "verified",
          privacyConsentAccepted: checkInConsentAccepted,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          marketingConsentAccepted: false,
        }),
      });
      setCheckedIn(true);
      setNotice(walkIn ? "Walk-in flagged for PMCM review." : "Check-in recorded.");
      await refreshEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check in");
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
    try {
      await apiFetch(guestPath(session, "/feedback"), {
        method: "POST",
        body: JSON.stringify({
          guestName: session.guestName,
          rating: Number(feedbackRating),
          comment: feedbackComment,
          privacyConsentAccepted: feedbackConsentAccepted,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          marketingConsentAccepted: false,
        }),
      });
      setFeedbackSubmitted(true);
      setNotice("Feedback submitted for moderation.");
      setFeedbackComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit feedback");
    } finally {
      setBusy(null);
    }
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      </main>
    );
  }

  const leaveEvent = () => {
    clearPrismSession(SESSION_KEY);
    router.replace("/open");
  };

  const scrollToCheckIn = () => document.getElementById("guest-check-in")?.scrollIntoView({ behavior: "smooth" });
  const scrollToDetails = () => document.getElementById("guest-details")?.scrollIntoView({ behavior: "smooth" });
  const scrollToFeedback = () => document.getElementById("guest-feedback")?.scrollIntoView({ behavior: "smooth" });
  const attendanceState = checkedIn ? (walkIn ? "Flagged walk-in" : "Recorded") : "Pending";
  const checkInButtonLabel = checkedIn ? "Attendance recorded" : walkIn ? "Submit walk-in for verification" : "Record name check-in";
  const feedbackState = feedbackSubmitted ? "Pending review" : feedbackConsentAccepted ? "Consent ready" : "Consent needed";

  return (
    <PrismDashboardShell
      roleLabel="Guest experience"
      eyebrow="Guest dashboard"
      title={`Hello, ${session.guestName}.`}
      description={`${session.eventName} - ${session.eventDate}`}
      activeItemId="pass"
      navItems={[
        { id: "pass", label: "Event pass", icon: TicketCheck },
        { id: "check-in", label: "Check in", icon: ScanLine, badge: checkedIn ? "Done" : undefined },
        { id: "agenda", label: "Event details", icon: ClipboardCheck },
        { id: "feedback", label: "Feedback", icon: MessageCircleHeart },
      ]}
      onNavSelect={(id) => {
        if (id === "check-in") scrollToCheckIn();
        if (id === "agenda") scrollToDetails();
        if (id === "feedback") scrollToFeedback();
      }}
      user={{ name: session.guestName, detail: session.guestAccessCode }}
      commandActions={[
        {
          id: "check-in",
          label: checkedIn ? "Check-in recorded" : "Check in at registration",
          description: "Record attendance with consent. Walk-ins are flagged for PMCM moderation.",
          icon: ScanLine,
          status: checkedIn ? "completed" : "pending",
          onSelect: scrollToCheckIn,
        },
        {
          id: "feedback",
          label: feedbackSubmitted ? "Feedback pending PMCM review" : "Submit moderated feedback",
          description: "Feedback is stored for PMCM review and is not published automatically.",
          icon: MessageCircleHeart,
          status: feedbackSubmitted ? "pending_review" : feedbackComment ? "in_review" : "pending",
          onSelect: scrollToFeedback,
        },
      ]}
      onSignOut={leaveEvent}
      headerActions={
        <>
          <Badge variant="outline" className="hidden h-9 rounded-md border-(--prism-amber)/35 bg-accent px-3 text-(--prism-amber) sm:inline-flex">
            {session.guestAccessCode}
          </Badge>
          <Button asChild variant="outline" size="sm" className="rounded-md font-bold">
            <a href="/open">Switch code</a>
          </Button>
        </>
      }
      mobileActions={[
        { id: "pass", label: "Pass", icon: TicketCheck, active: true },
        { id: "check-in", label: "Check in", icon: ScanLine, onSelect: scrollToCheckIn },
        { id: "agenda", label: "Details", icon: ClipboardCheck, onSelect: scrollToDetails },
        { id: "feedback", label: "Feedback", icon: MessageCircleHeart, onSelect: scrollToFeedback },
      ]}
      rightRail={
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border border-primary/20 bg-(--prism-ink) text-sidebar-foreground shadow-sm">
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">Guest pass</p>
              <h2 className="mt-2 text-xl font-black leading-tight">{session.eventName}</h2>
              <p className="mt-0.5 text-xs text-sidebar-foreground/60">{session.eventDate}</p>
            </div>
            <div className="mx-5 mb-5 grid place-items-center rounded-lg bg-card p-8">
              <QrCode className="size-28 text-foreground" />
              <p className="mt-4 text-center text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Show at registration desk
              </p>
              <p className="mt-1 text-center text-xs font-black text-(--prism-amber)">{session.guestAccessCode}</p>
              <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                Code verified on this browser. Dashboard access clears when you leave the event.
              </p>
            </div>
          </div>
          <PrismMetricTile label="Attendance count" value={session.attendanceCount} icon={Users} />
          <Button variant="outline" onClick={leaveEvent} className="h-10 rounded-md font-bold">
            <LogOut className="size-4" /> Leave event
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <PrismNoticeBanner tone="danger">{error}</PrismNoticeBanner>}
        {notice && <PrismNoticeBanner tone="success">{notice}</PrismNoticeBanner>}

        <RolePageHeader
          eyebrow="Guest access"
          title="Event-day actions stay code gated"
          description="Guests use the PMCM event code to open this pass, record consent-backed check-in, flag walk-ins for PMCM verification, and submit moderated feedback."
          meta={[session.clientName, `Code ${session.guestAccessCode}`, attendanceState]}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <PrismMetricTile label="Attendance state" value={attendanceState} icon={Users} detail={walkIn ? "Needs PMCM verification." : "Name-search check-in."} />
          <PrismMetricTile label="Access mode" value={walkIn ? "Walk-in" : "Listed guest"} icon={ScanLine} detail="No public dashboard shortcut." />
          <PrismMetricTile label="Feedback queue" value={feedbackState} icon={MessageCircleHeart} detail="Stored for moderation only." />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <PrismSectionPanel
              title="Registration check-in"
              icon={ScanLine}
              description="Records this guest against the event code. Walk-ins are visible to PMCM for moderation."
            >
              <div id="guest-check-in" className="scroll-mt-24" />
              <div className="flex flex-col gap-3">
                <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
                  <p className="font-bold text-foreground">Name-based check-in</p>
                  <p className="mt-0.5 leading-6 text-muted-foreground">
                    This browser-based check-in records guest name, check-in mode, consent version, and attendance time for PMCM registration review.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-3 border-l border-border px-3 py-2.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={walkIn}
                    onChange={(ev) => setWalkIn(ev.target.checked)}
                    className="size-4 accent-(--prism-amber)"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-foreground">Flag as walk-in for PMCM verification</span>
                    <span className="text-xs font-medium leading-5 text-muted-foreground">
                      Use this only when the guest is not on the registration list or needs operator approval.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 border-l border-border bg-background/60 px-3 py-2.5 text-sm leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={checkInConsentAccepted}
                    onChange={(ev) => setCheckInConsentAccepted(ev.target.checked)}
                    className="mt-0.5 size-4 accent-(--prism-amber)"
                  />
                  <span>
                    I consent to PMCM recording my name, check-in mode, attendance time, and this privacy notice version for registration and walk-in review.
                  </span>
                </label>
                {walkIn ? (
                  <div className="flex items-start gap-2 rounded-lg border border-(--prism-amber)/25 bg-(--prism-amber)/8 p-3 text-sm leading-6 text-(--prism-amber)">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    <span>Walk-ins are recorded as flagged first. PMCM or the event-day operator verifies authorization before treating the entry as cleared.</span>
                  </div>
                ) : null}
                <Button
                  disabled={busy === "check-in" || checkedIn || !checkInConsentAccepted}
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
              <div id="guest-details" className="scroll-mt-24" />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Event", session.eventName],
                  ["Date", session.eventDate],
                  ["Client", session.clientName],
                  ["Access code", session.guestAccessCode],
                  ["Readiness", session.readiness.replaceAll("_", " ")],
                  ["Floorplan", session.floorPlanStatus.replaceAll("_", " ")],
                ].map(([label, value]) => (
                  <div key={label} className="border-l border-border bg-background/60 px-3 py-2.5">
                    <p className="text-xs font-bold text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-black text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ["Planning", "completed"],
                  ["Event day", checkedIn ? "completed" : "current"],
                  ["Done", feedbackSubmitted ? "completed" : "pending"],
                ].map(([label, state]) => (
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
                      {state === "completed" ? "Complete" : state === "current" ? "Current step" : "Pending"}
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
              <div id="guest-feedback" className="scroll-mt-24" />
              <form onSubmit={submitFeedback} className="flex flex-col gap-3">
                <div className="border-l border-(--prism-sage) bg-background/60 px-3 py-2.5 text-sm">
                  <p className="font-bold text-foreground">Moderation state</p>
                  <p className="mt-0.5 leading-6 text-muted-foreground">
                    Submissions enter PMCM review. Nothing becomes public, client-facing, or testimonial content automatically.
                  </p>
                </div>
                <div className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Rating</span>
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
                          <Star className={active ? "size-5 fill-(--prism-amber)" : "size-5"} />
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
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={feedbackConsentAccepted}
                    onChange={(ev) => setFeedbackConsentAccepted(ev.target.checked)}
                    className="mt-0.5 size-4 accent-(--prism-amber)"
                  />
                  <span>
                    I consent to PMCM saving my name, rating, comment, consent version, and moderation status for post-event review. It will not be published automatically.
                  </span>
                </label>
                <Button disabled={busy === "feedback" || !feedbackConsentAccepted} className="h-12 rounded-md px-5 font-bold sm:w-fit" type="submit">
                  <MessageCircleHeart className="size-4" /> Send to PMCM moderation
                </Button>
                {feedbackSubmitted ? (
                  <div className="flex items-start gap-2 rounded-lg border border-(--prism-success)/20 bg-(--prism-success)/8 p-3 text-sm leading-6 text-(--prism-success)">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <span>Thank you. PMCM will review this feedback before any post-event reuse.</span>
                  </div>
                ) : null}
              </form>
            </PrismSectionPanel>
          </div>

          <PrismSectionPanel title="Event progress" icon={ClipboardCheck}>
            <PrismStatusTimeline
              items={[
                { id: "opened", title: "Invitation opened", status: "completed", description: "Guest code accepted for this event." },
                { id: "check-in", title: "Registration check-in", status: checkedIn ? "completed" : "pending", description: "Consent-backed event-day attendance record." },
                { id: "walk-in", title: "Walk-in verification", status: walkIn ? (checkedIn ? "flagged" : "pending") : "not_required", description: "Only applies when the guest is not on the list." },
                { id: "feedback", title: "Feedback moderation", status: feedbackSubmitted ? "pending_review" : "pending", description: "PMCM reviews feedback before any reuse." },
              ]}
            />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <span className="font-semibold text-foreground">Current readiness</span>
              <StatusBadge status={session.readiness} />
            </div>
            {checkedIn ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-(--prism-success)/20 bg-(--prism-success)/8 p-3 text-sm font-bold text-(--prism-success)">
                <CheckCircle2 className="size-4" />
                Check-in is recorded.
              </div>
            ) : null}
          </PrismSectionPanel>
        </div>
      </div>
    </PrismDashboardShell>
  );
}
