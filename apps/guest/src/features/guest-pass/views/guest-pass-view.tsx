"use client";

import { useState } from "react";
import { Check, Copy, TicketX } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { GUEST_QR_PASS_PREFIX, guestQrCheckInSchema } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { portalHref } from "@prism/ui/portal-path";

/** Groups the fallback code in fours so staff can read it back and type it without losing their place. */
function groupPassCode(token: string): string {
  return Array.from({ length: Math.ceil(token.length / 4) }, (_, index) => token.slice(index * 4, index * 4 + 4)).join(" ");
}

function PassCode({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    void navigator.clipboard.writeText(token).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="font-mono text-lg font-semibold tracking-wide text-foreground break-all">{groupPassCode(token)}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={copyCode}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? "Code copied" : "Copy code"}
      </Button>
    </div>
  );
}

/**
 * FR-39 Mode 1: the guest's QR pass. It is drawn from the link alone, so opening it calls no API and shows no
 * guest or event details; staff scan it at the registration desk.
 */
export function GuestPassView({ token }: { token: string }) {
  const valid = guestQrCheckInSchema.safeParse({ token }).success;
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <h1 className="text-xl font-bold text-foreground">Your event pass</h1>
      {valid ? (
        <>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <QRCodeSVG value={`${GUEST_QR_PASS_PREFIX}${token}`} size={240} aria-label="Guest QR pass" />
          </div>
          <p className="text-base leading-6 text-muted-foreground">Show this QR code at registration. If it does not scan, staff can type this code:</p>
          <PassCode token={token} />
        </>
      ) : (
        <Empty className="border-0 p-0">
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
    </main>
  );
}
