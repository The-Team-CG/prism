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
  TicketCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  PrismAppShell,
  PrismMetricTile,
  PrismNoticeBanner,
  PrismSectionPanel,
  PrismStatusTimeline,
  PrismTextarea,
  RolePageHeader,
} from "@prism/ui";

type GuestSession = {
  id: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  readiness: string;
  floorPlanStatus: string;
  activeFloorPlanDraftId?: string;
  guestAccessCode: string;
  attendanceCount: number;
  guestName: string;
  openedAt: string;
};

type GuestEvent = Omit<GuestSession, "guestName" | "openedAt">;

const SESSION_KEY = "prism:guest-session";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";
const PRIVACY_NOTICE_VERSION = "2026-05-01";

function readSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
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
    const event = await apiFetch<GuestEvent>(guestPath(current));
    const next = { ...current, ...event };
    setSession(next);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
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
    window.localStorage.removeItem(SESSION_KEY);
    router.replace("/open");
  };

  const scrollToCheckIn = () => document.getElementById("guest-check-in")?.scrollIntoView({ behavior: "smooth" });
  const scrollToFeedback = () => document.getElementById("guest-feedback")?.scrollIntoView({ behavior: "smooth" });

  return (
    <PrismAppShell
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
          label: "Submit moderated feedback",
          description: "Feedback is stored for PMCM review and is not published automatically.",
          icon: MessageCircleHeart,
          status: feedbackComment ? "in_review" : "pending",
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
            <a href="/open">Open with code</a>
          </Button>
        </>
      }
      mobileActions={[
        { id: "pass", label: "Pass", icon: TicketCheck, active: true },
        { id: "check-in", label: "Check in", icon: ScanLine, onSelect: scrollToCheckIn },
        { id: "feedback", label: "Feedback", icon: MessageCircleHeart, onSelect: scrollToFeedback },
      ]}
      rightRail={
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border border-primary/20 bg-(--prism-ink) text-sidebar-foreground shadow-[0_20px_60px_rgba(23,18,22,0.2)]">
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
          title="Fast event-day actions without an account"
          description="Guests use the PMCM event code to open a pass, record check-in consent, flag walk-ins for review, and submit moderated feedback."
          meta={[session.clientName, session.guestAccessCode, checkedIn ? "Checked in" : "Check-in pending"]}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <PrismMetricTile label="Check-in mode" value={walkIn ? "Walk-in" : "Name"} icon={ScanLine} />
          <PrismMetricTile label="Floorplan" value={session.floorPlanStatus.replaceAll("_", " ")} icon={TicketCheck} />
          <PrismMetricTile label="Feedback" value={feedbackConsentAccepted ? "Ready" : "Consent needed"} icon={MessageCircleHeart} />
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
                <div className="rounded-lg bg-secondary/60 p-4 text-sm">
                  <p className="font-bold text-foreground">Name-based check-in</p>
                  <p className="mt-0.5 text-muted-foreground">QR scanning remains deferred. This local defense flow records attendance and consent through the API.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={walkIn}
                    onChange={(ev) => setWalkIn(ev.target.checked)}
                    className="size-4 accent-(--prism-amber)"
                  />
                  Flag as walk-in for PMCM review
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={checkInConsentAccepted}
                    onChange={(ev) => setCheckInConsentAccepted(ev.target.checked)}
                    className="mt-0.5 size-4 accent-(--prism-amber)"
                  />
                  <span>I consent to PMCM recording this check-in against the event attendance record for registration and walk-in review.</span>
                </label>
                <Button
                  disabled={busy === "check-in" || checkedIn || !checkInConsentAccepted}
                  onClick={checkIn}
                  className="h-12 rounded-md font-bold sm:w-fit"
                >
                  <TicketCheck className="size-4" />
                  {checkedIn ? "Checked in" : "Check in"}
                </Button>
              </div>
            </PrismSectionPanel>

            <PrismSectionPanel
              title="Moderated feedback"
              icon={MessageCircleHeart}
              description="Feedback is saved for PMCM review and is never published automatically."
            >
              <div id="guest-feedback" className="scroll-mt-24" />
              <form onSubmit={submitFeedback} className="flex flex-col gap-3">
                <Input
                  value={feedbackRating}
                  onChange={(ev) => setFeedbackRating(ev.target.value)}
                  type="number"
                  min="1"
                  max="5"
                  className="h-10 rounded-md"
                  placeholder="Rating 1-5"
                />
                <PrismTextarea
                  value={feedbackComment}
                  onChange={(ev) => setFeedbackComment(ev.target.value)}
                  placeholder="Share feedback for PMCM moderation"
                />
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={feedbackConsentAccepted}
                    onChange={(ev) => setFeedbackConsentAccepted(ev.target.checked)}
                    className="mt-0.5 size-4 accent-(--prism-amber)"
                  />
                  <span>I consent to PMCM saving this feedback for moderation and post-event review. It will not be published automatically.</span>
                </label>
                <Button disabled={busy === "feedback" || !feedbackConsentAccepted} className="h-11 rounded-md font-bold sm:w-fit" type="submit">
                  <MessageCircleHeart className="size-4" /> Submit feedback
                </Button>
              </form>
            </PrismSectionPanel>
          </div>

          <PrismSectionPanel title="Event progress" icon={ClipboardCheck}>
            <PrismStatusTimeline
              items={[
                { id: "opened", title: "Invitation opened", status: "completed", description: "Guest code accepted for this event." },
                { id: "check-in", title: "Registration check-in", status: checkedIn ? "completed" : "pending", description: "Consent-backed event-day attendance record." },
                { id: "floorplan", title: "Official floorplan", status: session.floorPlanStatus, description: "Read-only event readiness signal." },
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
    </PrismAppShell>
  );
}
