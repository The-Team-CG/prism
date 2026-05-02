"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, QrCode, Sparkles, TicketCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
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

  useEffect(() => {
    setExisting(readSession());
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const normalizedCode = encodeURIComponent(accessCode.trim().toUpperCase());
      const guestEvent = await request<GuestEvent>(`/api/guest/events/${normalizedCode}`);
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
    <main className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1180px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <a href="/" className="inline-flex items-center gap-3">
            <span className="flex h-12 w-36 items-center justify-center rounded-md border border-primary/12 bg-white px-3 shadow-sm">
              <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.24em] text-foreground">P.R.I.S.M</span>
              <span className="block text-sm text-muted-foreground">Guest Experience</span>
            </span>
          </a>
          <Badge variant="outline" className="mt-10 rounded-full border-(--prism-amber)/40 bg-accent px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">
            <Sparkles className="size-4" /> Open with event code
          </Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-none sm:text-6xl">
            Guests do not need accounts.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            PMCM generates a guest access code from each confirmed event. Guests enter that code to open the event pass, check-in status, prompts, and moderated feedback flow.
          </p>
        </section>

        <Card className="rounded-lg border-primary/12 bg-card shadow-[0_24px_80px_rgba(23,18,22,0.12)]">
          <form onSubmit={submit}>
            <CardHeader>
              <div className="grid size-11 place-items-center rounded-md bg-secondary text-primary">
                <KeyRound className="size-5" />
              </div>
              <CardTitle className="mt-2 text-2xl font-black">Open event</CardTitle>
              <p className="text-sm text-muted-foreground">Use the code generated from the PMCM event record.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input value={guestName} onChange={(event) => setGuestName(event.target.value)} className="h-11 bg-white" />
              <Input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} className="h-11 bg-white font-black uppercase tracking-wide" />
              {error && (
                <Alert variant="destructive" className="rounded-md">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button disabled={busy} className="h-11 w-full rounded-md font-black">
                {busy ? "Opening" : "Open with code"} <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </form>
          {existing && (
            <a href="/dashboard" className="mx-5 mb-4 inline-flex h-10 w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-md bg-secondary text-sm font-black text-foreground">
              <TicketCheck className="size-4" /> Continue to {existing.eventName}
            </a>
          )}
          <p className="flex items-center gap-2 px-5 pb-5 text-xs leading-5 text-muted-foreground">
            <QrCode className="size-4" /> Demo event code: AYALA-TECH-YALA
          </p>
        </Card>
      </div>
    </main>
  );
}
