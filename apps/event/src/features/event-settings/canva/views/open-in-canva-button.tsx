"use client";

import { useState } from "react";
import type { PrismCanvaDesign } from "@prism/types";

/** Fills a Canva template and opens the design for editing in a new tab. */
export function OpenInCanvaButton({ label, fill }: { label: string; fill: () => Promise<PrismCanvaDesign> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setError(null);
    try { window.open((await fill()).editUrl, "_blank", "noopener"); } catch (caught) { setError(caught instanceof Error ? caught.message : "Canva request failed."); } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={busy} onClick={() => void open()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{busy ? "Making the design…" : label}</button>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
