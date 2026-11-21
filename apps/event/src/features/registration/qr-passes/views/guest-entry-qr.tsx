"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";

/** The guest-portal link the event's entry QR opens: the code is carried in the link, so the pass opens with nothing to type. */
export function guestEntryLink(accessCode: string): string {
  const origin = portalUrlsFromEnvironment().NEXT_PUBLIC_GUEST_PORTAL_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_GUEST_PORTAL_URL is not configured");
  return `${origin.replace(/\/+$/, "")}/open?code=${encodeURIComponent(accessCode)}`;
}

/**
 * One QR for the whole event, for invitations, table cards and the entrance. A guest who scans it lands on their pass
 * and can check in; it carries only the event code they would otherwise type.
 */
export function GuestEntryQr({ accessCode }: { accessCode: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!accessCode) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 text-sm">
        <h3 className="font-semibold">Guest entry QR</h3>
        <p className="mt-1 text-xs text-muted-foreground">The guest code is generated after event setup; the entry QR appears with it.</p>
      </section>
    );
  }
  const link = guestEntryLink(accessCode);
  return (
    <section className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <div className="w-fit rounded-md border border-border bg-white p-3">
          <QRCodeSVG value={link} size={144} aria-label="Guest entry QR code" />
        </div>
        <div className="grid min-w-0 content-start gap-2">
          <div>
            <h3 className="font-semibold">Guest entry QR</h3>
            <p className="text-xs text-muted-foreground">Put it on invitations, table cards and the entrance. Scanning it opens the guest pass for this event, ready to check in. It carries the event code {accessCode}, nothing else.</p>
          </div>
          <p className="font-mono text-xs break-all text-muted-foreground [overflow-wrap:anywhere]">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(link).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); })}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Print</button>
          </div>
        </div>
      </div>
    </section>
  );
}
