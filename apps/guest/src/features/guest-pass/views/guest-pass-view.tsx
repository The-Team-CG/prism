"use client";

import { useState } from "react";
import { Check, Copy, TicketX } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { GUEST_QR_PASS_PREFIX, guestQrCheckInSchema } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { portalHref } from "@prism/ui/portal-path";
import { PrismGuestShell } from "@prism/ui";

/** Groups the fallback code in fours so staff can read it back and type it without losing their place. */
function groupPassCode(token: string): string {
  return Array.from({ length: Math.ceil(token.length / 4) }, (_, index) => token.slice(index * 4, index * 4 + 4)).join(" ");
}

/** The typed fallback, folded away: it is for staff whose scanner fails, not something the guest needs to read. */
function PassCode({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    void navigator.clipboard.writeText(token).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  return (
    <details className="rounded-xl border border-border bg-card px-4 text-sm">
      <summary className="flex min-h-12 cursor-pointer items-center justify-center font-semibold text-primary">Scanner not working? Show the code</summary>
      <div className="grid justify-items-center gap-3 pb-4 text-center">
        <p className="font-mono text-base font-semibold tracking-wide text-foreground break-all">{groupPassCode(token)}</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={copyCode}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Code copied" : "Copy code"}
        </Button>
      </div>
    </details>
  );
}

/**
 * FR-39 Mode 1: the guest's QR pass. It is drawn from the link alone, so opening it calls no API and shows no
 * guest or event details; staff scan it at the registration desk.
 */
export function GuestPassView({ token }: { token: string }) {
  const valid = guestQrCheckInSchema.safeParse({ token }).success;
  return (
    <PrismGuestShell eventName="Your event pass" layout="narrow" lead={<span />}>
      {valid ? (
        <div className="grid gap-3">
          <section aria-labelledby="pass-title" className="grid justify-items-center gap-4 rounded-2xl bg-ink px-5 pb-6 pt-5 text-center text-ink-foreground">
            <div>
              <p className="text-sm text-ink-foreground/70">Personal pass</p>
              <h1 id="pass-title" className="mt-0.5 font-heading text-2xl font-semibold leading-tight">Your event pass</h1>
            </div>
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={`${GUEST_QR_PASS_PREFIX}${token}`} size={220} aria-label="Guest QR pass" />
            </div>
            <p className="max-w-64 text-sm leading-5 text-ink-foreground/80">Show this at the entrance. Registration scans it to check you in.</p>
          </section>
          <PassCode token={token} />
          <p className="px-1 text-center text-xs leading-5 text-muted-foreground">Keep this link to yourself: it checks in one guest.</p>
        </div>
      ) : (
        <Empty className="border-0 p-0 pt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketX />
            </EmptyMedia>
            <EmptyTitle>This pass link is not valid</EmptyTitle>
            <EmptyDescription>Ask the event organizer for a new one.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild className="min-h-11">
              <a href={portalHref("/")}>Back to guest portal</a>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </PrismGuestShell>
  );
}
