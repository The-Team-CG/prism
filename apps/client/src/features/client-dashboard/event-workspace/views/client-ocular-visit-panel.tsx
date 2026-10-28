"use client";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { useState, type FormEvent } from "react";
import type { PrismClientOcularVisit } from "@prism/types";

function formatScheduledAt(scheduledAt: string | null) {
  return formatPortalDateTime(scheduledAt, "Date pending");
}

export function ClientOcularVisitPanel({
  visit,
  busy,
  onSubmit,
}: {
  visit: PrismClientOcularVisit | null;
  busy: boolean;
  onSubmit: (clientNote: string) => Promise<void>;
}) {
  const [clientNote, setClientNote] = useState("");

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(clientNote.trim());
  }

  const statusCopy = visit
    ? {
        requested: {
          title: "Ocular visit requested",
          detail: "PMCM has received your request and will coordinate a schedule.",
        },
        scheduled: {
          title: "Ocular visit scheduled",
          detail: `PMCM scheduled the visit for ${formatScheduledAt(visit.scheduledAt)}.`,
        },
        completed: {
          title: "Ocular visit completed",
          detail: "The ocular visit is complete.",
        },
        waived: {
          title: "Ocular visit waived",
          detail: "PMCM marked this visit step as waived.",
        },
      }[visit.status]
    : null;

  return (
    <section aria-labelledby="client-ocular-visit-title" className="rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="client-ocular-visit-title" className="text-base font-semibold text-foreground">
          Ocular visit
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Coordinate a venue visit with the PMCM event team.
        </p>
      </div>

      {visit && statusCopy ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4" aria-live="polite">
          <p className="font-medium text-foreground">{statusCopy.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{statusCopy.detail}</p>
        </div>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={submitRequest}>
          <label htmlFor="ocular-visit-client-note" className="block text-sm font-medium text-foreground">
            Optional note for PMCM
          </label>
          <textarea
            id="ocular-visit-client-note"
            value={clientNote}
            onChange={(event) => setClientNote(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            disabled={busy}
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Submitting request…" : "Request ocular visit"}
          </button>
        </form>
      )}
    </section>
  );
}
