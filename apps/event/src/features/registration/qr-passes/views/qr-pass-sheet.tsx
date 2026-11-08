"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GUEST_QR_PASS_PREFIX, type PrismGuestQrPass } from "@prism/types";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";
import { qrPassRepository } from "../data/qr-pass-repository";

function passLink(token: string): string {
  const origin = portalUrlsFromEnvironment().NEXT_PUBLIC_GUEST_PORTAL_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_GUEST_PORTAL_URL is not configured");
  return `${origin.replace(/\/+$/, "")}/pass/${token}`;
}

function mailto(pass: PrismGuestQrPass, link: string): string {
  const body = `Hi ${pass.guestName},\n\nShow this pass at registration: ${link}\n\nIf the QR does not scan, give staff this code: ${pass.token}`;
  return `mailto:${encodeURIComponent(pass.email)}?subject=${encodeURIComponent("Your event pass")}&body=${encodeURIComponent(body)}`;
}

/** FR-39 Mode 1: PMCM issues QR passes to guests with an email, then prints them or emails each guest their pass link. */
export function QrPassSheet({ eventId }: { eventId: string }) {
  const [passes, setPasses] = useState<PrismGuestQrPass[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (load: () => Promise<PrismGuestQrPass[]>) => {
    setBusy(true);
    setError(null);
    try { setPasses(await load()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load guest passes."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void run(() => qrPassRepository.list(eventId)); }, [eventId, run]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">QR guest passes</h3>
          <p className="text-xs text-muted-foreground">Optional: guests with an email get a QR pass. Name search and headcount check-in keep working for everyone else.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void run(() => qrPassRepository.issue(eventId))} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Issue passes</button>
          {passes.length ? <button type="button" onClick={() => window.print()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Print</button> : null}
        </div>
      </div>
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {passes.map((pass) => {
          const link = passLink(pass.token);
          return (
            <li key={pass.rosterEntryId} className="rounded-md border border-border p-3">
              <QRCodeSVG value={`${GUEST_QR_PASS_PREFIX}${pass.token}`} size={128} aria-label={`QR pass for ${pass.guestName}`} />
              <p className="mt-2 font-semibold">{pass.guestName}</p>
              <p className="break-all font-mono text-3xs text-muted-foreground">{pass.token}</p>
              <p className="mt-1 text-xs">{pass.checkedInAt ? "Checked in" : "Not checked in"}</p>
              <a href={mailto(pass, link)} className="mt-1 inline-block text-xs font-semibold text-primary">Email pass to {pass.email}</a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
