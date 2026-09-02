"use client";

import { QRCodeSVG } from "qrcode.react";
import { Users } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useGuestEventInfoViewModel } from "../view-models/use-guest-event-info-view-model";

export function GuestEventInfoView({
  accessCode,
}: {
  accessCode: string;
}) {
  const vm = useGuestEventInfoViewModel(accessCode);

  if (vm.status === "loading" || vm.status === "idle") {
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

  if (vm.status === "error" || !vm.event) {
    return (
      <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-2xl font-black">Event not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {vm.error || "This event code is invalid or the event has been removed."}
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

  return (
    <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl bg-[linear-gradient(135deg,#171216,#251222_48%,#10242b)] px-6 py-8 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
            Event information
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">{vm.event.eventName}</h1>
          <p className="mt-1 text-sm text-white/60">
            {vm.event.clientName} &middot; {vm.event.eventDate}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-bold">
            <Users className="size-4 text-(--prism-amber)" />
            {vm.event.attendanceCount} guest(s) checked in
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {vm.infoRows.map((row) => (
            <div
              key={row.label}
              className="border-l border-border bg-background/60 px-3 py-2.5"
            >
              <p className="text-xs font-bold text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-sm font-black text-foreground">{row.value}</p>
            </div>
          ))}
        </div>

        {vm.qrUrl ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-border bg-background/60 p-6">
            <QRCodeSVG
              value={vm.qrUrl}
              size={180}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Scan to open this page on another device
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
