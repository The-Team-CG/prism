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
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Separator } from "@/app/components/ui/separator";
import { StatusBadge } from "@/app/components/ui/status-badge";

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

function SectionPanel({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <span className="grid size-7 place-items-center rounded-md bg-secondary text-(--prism-amber)">
          <Icon className="size-3.5" />
        </span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
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
        <div className="h-8 w-48 animate-pulse rounded-xl bg-secondary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[260px_minmax(0,1fr)]">

        {/* Sidebar */}
        <aside className="border-r border-primary/20 bg-sidebar p-5 text-sidebar-foreground lg:h-screen lg:overflow-y-auto">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-32 items-center justify-center rounded-lg border border-white/10 bg-white px-2.5 shadow-sm">
              <img src="/pmcm-logo.png" alt="PMCM logo" className="h-8 w-full object-contain" />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.22em] text-(--prism-amber)">P.R.I.S.M</span>
              <span className="block text-xs text-sidebar-foreground/70">Guest experience</span>
            </span>
          </a>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/7 p-3">
            <Avatar className="size-10 border border-(--prism-amber)/30">
              <AvatarFallback className="bg-card text-xs font-black text-foreground">
                {session.guestName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{session.guestName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{session.guestAccessCode}</p>
            </div>
          </div>

          <nav className="mt-7 flex flex-col gap-1">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Navigation</p>
            {[
              { label: "Dashboard", icon: TicketCheck, active: true },
              { label: "Pass", icon: QrCode },
              { label: "Agenda", icon: ClipboardCheck },
              { label: "Feedback", icon: MessageCircleHeart },
            ].map(({ label, icon: Icon, active }) => (
              <a
                key={label}
                href="#"
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                  active ? "bg-white/12 text-white" : "text-sidebar-foreground/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </a>
            ))}
          </nav>

          <Separator className="my-5 bg-white/10" />

          <Button
            variant="outline"
            onClick={() => { window.localStorage.removeItem(SESSION_KEY); router.replace("/open"); }}
            className="h-10 w-full justify-start border-white/15 bg-transparent text-sidebar-foreground hover:bg-white/10"
          >
            <LogOut className="size-4" /> Leave event
          </Button>
        </aside>

        {/* Main content */}
        <section className="min-w-0 px-5 py-5 sm:px-8 lg:h-screen lg:overflow-y-auto">

          {/* Topbar */}
          <header className="sticky top-0 z-30 mb-6 rounded-xl border border-border bg-card/92 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem><BreadcrumbLink href="/">Guest</BreadcrumbLink></BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem><BreadcrumbPage>Event pass</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-9 rounded-lg border-(--prism-amber)/35 bg-accent px-3 text-(--prism-amber) hidden sm:inline-flex">
                  {session.guestAccessCode}
                </Badge>
                <Button asChild variant="outline" size="sm" className="rounded-lg font-bold">
                  <a href="/open">Open with code</a>
                </Button>
                <Avatar className="size-9 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-(--prism-ink) text-xs font-black text-sidebar-foreground">
                    {session.guestName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Guest dashboard</p>
              <h1 className="mt-1 text-2xl font-black leading-none text-foreground">Hello, {session.guestName}.</h1>
              <p className="mt-1 text-sm text-muted-foreground">{session.eventName} · {session.eventDate}</p>
            </div>
          </header>

          {/* Alerts */}
          {error && (
            <div className="mb-4 rounded-xl border border-(--prism-danger)/20 bg-(--prism-danger)/8 px-4 py-3 text-sm text-(--prism-danger)">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-xl border border-(--prism-success)/20 bg-(--prism-success)/8 px-4 py-3 text-sm text-(--prism-success)">
              {notice}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">

            {/* QR pass card — hero on mobile */}
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-primary/20 bg-(--prism-ink) text-sidebar-foreground shadow-[0_20px_60px_rgba(23,18,22,0.2)]">
                <div className="p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-(--prism-amber)">Guest pass</p>
                  <h2 className="mt-2 text-xl font-black leading-tight">{session.eventName}</h2>
                  <p className="mt-0.5 text-xs text-sidebar-foreground/60">{session.eventDate}</p>
                </div>
                <div className="mx-5 mb-5 grid place-items-center rounded-xl bg-card p-8">
                  <QrCode className="size-28 text-foreground" />
                  <p className="mt-4 text-center text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Show at registration desk
                  </p>
                  <p className="mt-1 text-center text-xs font-black text-(--prism-amber)">{session.guestAccessCode}</p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  [TicketCheck, "Pass"],
                  [ScanLine, "Check in"],
                  [MessageCircleHeart, "Feedback"],
                ] as const).map(([Icon, label]) => (
                  <button
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-4 text-center shadow-sm transition hover:border-primary/30"
                  >
                    <Icon className="size-5 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">{label}</span>
                  </button>
                ))}
              </div>

              {/* Attendance */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Users className="size-4" />
                </span>
                <div>
                  <p className="text-xl font-black leading-none text-foreground">{session.attendanceCount}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Attendance count</p>
                </div>
              </div>
            </div>

            {/* Interaction panels */}
            <div className="space-y-4">
              {/* Moment cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  [ScanLine, "Name check-in", "Registration records your name against this event code."],
                  [TicketCheck, "Walk-in flag", "Walk-ins are marked for PMCM verification."],
                  [MessageCircleHeart, "Feedback", "Ratings and comments stay in PMCM moderation."],
                ] as const).map(([Icon, title, detail]) => (
                  <div key={title} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-(--prism-amber)">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="mt-3.5 text-sm font-bold text-foreground">{title}</h3>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>

              {/* Check-in panel */}
              <SectionPanel icon={ScanLine} title="Registration check-in">
                <div className="space-y-3">
                  <div className="rounded-xl bg-secondary/60 p-4 text-sm">
                    <p className="font-bold text-foreground">Name-based check-in</p>
                    <p className="mt-0.5 text-muted-foreground">Records this guest against the event code without requiring an account. QR scanning stays deferred for the defense pass.</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={walkIn}
                      onChange={(ev) => setWalkIn(ev.target.checked)}
                      className="size-4 accent-(--prism-amber)"
                    />
                    Flag as walk-in for PMCM review
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
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
                    className="rounded-xl font-bold"
                  >
                    <TicketCheck className="size-4" />
                    {checkedIn ? "Checked in" : "Check in"}
                  </Button>
                </div>
              </SectionPanel>

              {/* Feedback panel */}
              <SectionPanel icon={MessageCircleHeart} title="Moderated feedback">
                <form onSubmit={submitFeedback} className="space-y-3">
                  <Input
                    value={feedbackRating}
                    onChange={(ev) => setFeedbackRating(ev.target.value)}
                    type="number"
                    min="1"
                    max="5"
                    className="h-10 rounded-lg"
                    placeholder="Rating 1–5"
                  />
                  <textarea
                    value={feedbackComment}
                    onChange={(ev) => setFeedbackComment(ev.target.value)}
                    className="min-h-24 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    placeholder="Share feedback for PMCM moderation"
                  />
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={feedbackConsentAccepted}
                      onChange={(ev) => setFeedbackConsentAccepted(ev.target.checked)}
                      className="mt-0.5 size-4 accent-(--prism-amber)"
                    />
                    <span>I consent to PMCM saving this feedback for moderation and post-event review. It will not be published automatically.</span>
                  </label>
                  <Button disabled={busy === "feedback" || !feedbackConsentAccepted} className="rounded-xl font-bold" type="submit">
                    <MessageCircleHeart className="size-4" /> Submit feedback
                  </Button>
                </form>
              </SectionPanel>

              {/* Progress panel */}
              <SectionPanel icon={ClipboardCheck} title="Event progress">
                <div className="divide-y divide-border text-sm">
                  {[
                    { label: "Invitation opened", status: "completed" },
                    { label: "Registration check-in", status: checkedIn ? "completed" : "pending" },
                    { label: "Official floorplan", status: session.floorPlanStatus },
                  ].map(({ label, status }) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-3">
                      <span className="font-semibold text-foreground">{label}</span>
                      <StatusBadge status={status} />
                    </div>
                  ))}
                </div>
              </SectionPanel>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
