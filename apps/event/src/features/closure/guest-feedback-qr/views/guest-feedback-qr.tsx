"use client";

import { QRCodeSVG } from "qrcode.react";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";

/** The guest-portal link the QR opens: the event code is filled in, and the guest lands on the page with feedback. */
export function guestFeedbackLink(accessCode: string): string {
  const origin = portalUrlsFromEnvironment().NEXT_PUBLIC_GUEST_PORTAL_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_GUEST_PORTAL_URL is not configured");
  return `${origin.replace(/\/+$/, "")}/open?code=${encodeURIComponent(accessCode)}&next=${encodeURIComponent("/dashboard")}`;
}

/** New-EX2 / FR-41: a post-event QR for the LED wall or table cards that opens the guest feedback page; no account or app needed. */
export function GuestFeedbackQr({ accessCode }: { accessCode: string | null | undefined }) {
  if (!accessCode) return <p className="text-sm text-muted-foreground">The guest code is generated after event setup; the feedback QR appears with it.</p>;
  const link = guestFeedbackLink(accessCode);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <QRCodeSVG value={link} size={160} aria-label="Guest feedback QR code" />
      <div className="space-y-2 text-sm">
        <p>Guests scan this after the event to rate it and leave feedback. Every submission goes to the moderated queue.</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{link}</p>
        <button type="button" onClick={() => window.print()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Print</button>
      </div>
    </div>
  );
}
