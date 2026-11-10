"use client";

import { useEffect, useState } from "react";
import type { PrismCanvaConnection } from "@prism/types";
import { canvaRepository } from "../data/canva-repository";

/** FR-59 and New-P3: PMCM connects the organization's Canva account once; proposals and testimonials then fill its templates. */
export function CanvaConnectionCard() {
  const [connection, setConnection] = useState<PrismCanvaConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const returned = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("canva");

  useEffect(() => { void canvaRepository.status().then(setConnection).catch(() => setConnection(null)); }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Canva request failed."); } finally { setBusy(false); }
  }

  if (!connection) return null;
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="text-base font-semibold">Canva</h2>
      {returned === "failed" ? <p role="alert" className="text-destructive">Canva was not connected. Try again.</p> : null}
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {!connection.configured ? <p className="text-muted-foreground">Canva is not set up for this deployment.</p> : connection.connected ? (
        <>
          <p>Connected{connection.connectedAt ? ` since ${new Date(connection.connectedAt).toLocaleDateString()}` : ""}. Proposal template: {connection.templates.proposal ? "set" : "not set"}. Testimonial template: {connection.templates.testimonial ? "set" : "not set"}.</p>
          <button type="button" disabled={busy} onClick={() => void run(async () => setConnection(await canvaRepository.disconnect()))} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Disconnect Canva</button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run(async () => { window.location.assign((await canvaRepository.authorize()).url); })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Connect Canva</button>
      )}
    </section>
  );
}
