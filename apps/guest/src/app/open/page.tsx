"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, QrCode, ShieldCheck, TicketCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type GuestEvent = {
  id: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  readiness: string;
  floorPlanStatus: string;
  activeFloorPlanDraftId?: string;
  guestAccessCode: string;
  attendanceCount: number;
};

type GuestSession = GuestEvent & {
  guestName: string;
  openedAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SESSION_KEY = "prism:guest-session";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch (error) {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || "Event code was not found");
  }
  return body.data as T;
}

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

export default function GuestOpenWithCode() {
  const router = useRouter();
  const [guestName, setGuestName] = useState("Sofia Lim");
  const [accessCode, setAccessCode] = useState("AYALA-TECH-YALA");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<GuestSession | null>(null);
  const [preview, setPreview] = useState<GuestEvent | null>(null);

  useEffect(() => {
    setExisting(readSession());
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const normalizedCode = encodeURIComponent(accessCode.trim().toUpperCase());
      const guestEvent = preview ?? await request<GuestEvent>(`/api/guest/events/${normalizedCode}`);
      if (!preview) {
        setPreview(guestEvent);
        return;
      }
      const session: GuestSession = {
        ...guestEvent,
        guestName,
        openedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden bg-(--prism-ink) p-8 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-md bg-white text-sm font-black text-(--prism-ink)">P</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-signal)">P.R.I.S.M</p>
                  <p className="text-xs text-sidebar-foreground/60">Guest pass</p>
                </div>
              </div>
              <div className="mt-12 grid place-items-center rounded-lg border border-white/10 bg-white/6 p-12">
                <QrCode className="size-32 text-(--prism-amber)" />
              </div>
            </div>
            <p className="text-sm leading-6 text-sidebar-foreground/62">
              Enter the event code from your PMCM invitation. The pass opens only the guest-safe check-in, event details, and moderated feedback flow.
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="h-1 w-24 rounded-sm bg-(--prism-signal)" />
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                <KeyRound className="size-5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Guest access</p>
                <h1 className="mt-1 text-3xl font-black leading-tight">Open your event pass</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Preview the event first, then continue into the code-gated dashboard.
                </p>
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Guest name</span>
              <Input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                autoComplete="name"
                className="h-12 bg-white"
                placeholder="Name at registration"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Event code</span>
              <Input
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(event.target.value);
                  setPreview(null);
                }}
                autoCapitalize="characters"
                autoComplete="off"
                className="h-14 bg-white font-mono text-lg font-black uppercase tracking-[0.18em]"
                placeholder="PMCM EVENT CODE"
              />
            </label>

            {preview ? (
              <section className="rounded-lg border border-primary/15 bg-secondary/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Event preview</p>
                    <h2 className="mt-1 text-xl font-black">{preview.eventName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{preview.clientName} - {preview.eventDate}</p>
                  </div>
                  <span className="rounded-md border border-(--prism-amber)/25 bg-(--prism-amber)/10 px-2 py-1 text-xs font-bold text-(--prism-amber)">
                    {preview.readiness.replaceAll("_", " ")}
                  </span>
                </div>
              </section>
            ) : null}

            {error && (
              <Alert variant="destructive" className="rounded-md">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button disabled={busy || !guestName.trim() || !accessCode.trim()} className="h-12 w-full rounded-md font-black">
              {busy ? "Opening" : preview ? "Continue" : "Preview event"} <ArrowRight className="size-4" />
            </Button>

            {existing && (
              <a href="/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary text-sm font-black text-foreground">
                <TicketCheck className="size-4" /> Continue to {existing.eventName}
              </a>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Code access opens only this guest event. Read the <a href="#privacy-notice" className="font-black text-primary underline underline-offset-2">privacy notice</a> before check-in or feedback consent.
              </span>
            </div>

            <p id="privacy-notice" className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
              <QrCode className="size-4 text-(--prism-amber)" /> Sample event code: AYALA-TECH-YALA
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
