"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";
import { FieldGroup } from "@prism/ui/components/field";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";

/** The guest-portal link the QR opens: the event code is filled in, and the guest lands on the page with feedback. */
export function guestFeedbackLink(accessCode: string): string {
  const origin = portalUrlsFromEnvironment().NEXT_PUBLIC_GUEST_PORTAL_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_GUEST_PORTAL_URL is not configured");
  return `${origin.replace(/\/+$/, "")}/open?code=${encodeURIComponent(accessCode)}&next=${encodeURIComponent("/dashboard")}`;
}

/** New-EX2 / FR-41: a post-event QR for the LED wall or table cards that opens the guest feedback page; no account or app needed. */
export function GuestFeedbackQr({ accessCode }: { accessCode: string | null | undefined }) {
  if (!accessCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Guest feedback QR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The guest code is generated after event setup; the feedback QR appears with it.</p>
        </CardContent>
      </Card>
    );
  }
  const link = guestFeedbackLink(accessCode);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest feedback QR</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="rounded-md border border-border bg-white p-3">
            <QRCodeSVG value={link} size={160} aria-label="Guest feedback QR code" />
          </div>
          <div className="grid min-w-0 content-start gap-3 text-sm">
            <p>Guests scan this after the event to rate it and leave feedback. Every submission goes to the moderated queue.</p>
            <p className="font-mono text-xs break-all text-muted-foreground [overflow-wrap:anywhere]">{link}</p>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
            </div>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
