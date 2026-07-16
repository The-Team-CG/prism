"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Users } from "lucide-react";
import type { PrismGuestEventPass } from "@prism/types";
import { Skeleton } from "@/app/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const GUEST_URL = process.env.NEXT_PUBLIC_GUEST_URL ?? "http://localhost:3003";
const API_OFFLINE_MESSAGE =
  "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

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
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || "Event not found");
  }
  return body.data as T;
}

export default function GuestEventInfo({
  params,
}: {
  params: Promise<{ accessCode: string }>;
}) {
  const [event, setEvent] = useState<PrismGuestEventPass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ accessCode }) => {
      const code = decodeURIComponent(accessCode);
      request<PrismGuestEventPass>(`/api/guest/events/${code}`)
        .then(setEvent)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Event not found"),
        )
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-2xl font-black">Event not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error || "This event code is invalid or the event has been removed."}
          </p>
          <a
            href="/"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-secondary px-4 text-sm font-black text-foreground"
          >
            Go home
          </a>
        </div>
      </main>
    );
  }

  const qrUrl = `${GUEST_URL}/info/${encodeURIComponent(event.guestAccessCode)}`;

  const infoRows = [
    ["Event", event.eventName],
    ["Date", event.eventDate],
    ["Client", event.clientName],
    ["Readiness", event.readiness.replaceAll("_", " ")],
    ["Floorplan", event.floorPlanStatus.replaceAll("_", " ")],
  ] as const;

  return (
    <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl bg-[linear-gradient(135deg,#171216,#251222_48%,#10242b)] px-6 py-8 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
            Event information
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">
            {event.eventName}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {event.clientName} &middot; {event.eventDate}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-bold">
            <Users className="size-4 text-(--prism-amber)" />
            {event.attendanceCount} guest(s) checked in
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {infoRows.map(([label, value]) => (
            <div
              key={label}
              className="border-l border-border bg-background/60 px-3 py-2.5"
            >
              <p className="text-xs font-bold text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-black text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-border bg-background/60 p-6">
          <QRCodeSVG
            value={qrUrl}
            size={180}
            bgColor="transparent"
            fgColor="currentColor"
            className="text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Scan to open this page on another device
          </p>
        </div>
      </div>
    </main>
  );
}
