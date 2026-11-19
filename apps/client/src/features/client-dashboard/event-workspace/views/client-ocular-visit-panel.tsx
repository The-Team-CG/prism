"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { PrismSection } from "@prism/ui/page-blocks";

/**
 * Asking PMCM for a venue visit, shown on the overview until the client asks. Once asked, the visit is a Coming up
 * line (waiting on PMCM, then dated with PMCM's note), so this only ever offers the request.
 */
export function ClientOcularVisitPanel({ busy, onSubmit }: { busy: boolean; onSubmit: (clientNote: string) => Promise<void> }) {
  const [clientNote, setClientNote] = useState("");

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(clientNote.trim());
  }

  return (
    <PrismSection
      id="client-ocular-visit-title"
      title="Venue visit"
      description="Walk the venue with PMCM before the layout is drawn. Ask, and PMCM sets the date."
      headerOutside
    >
      <form className="flex flex-wrap items-end gap-3" onSubmit={submitRequest}>
        <div className="min-w-0 flex-1 basis-64 space-y-1.5">
          <label htmlFor="ocular-visit-client-note" className="block text-sm font-medium text-foreground">Note for PMCM (optional)</label>
          <Input id="ocular-visit-client-note" value={clientNote} onChange={(event) => setClientNote(event.target.value)} placeholder="Weekday mornings suit us best" disabled={busy} />
        </div>
        <Button type="submit" variant="outline" disabled={busy}>{busy ? "Sending…" : "Ask for a venue visit"}</Button>
      </form>
    </PrismSection>
  );
}
