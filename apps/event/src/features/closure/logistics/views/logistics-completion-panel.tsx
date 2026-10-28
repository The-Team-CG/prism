"use client";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { useState } from "react";
import { useLogisticsCompletionViewModel } from "../view-models/use-logistics-completion-view-model";

const emptyDraft = { assetReturnsVerified: false, completionSummary: "", privateNotes: "", correctionReason: "" };

export function LogisticsCompletionPanel({ eventId }: { eventId: string }) {
  const vm = useLogisticsCompletionViewModel(eventId);
  const [draft, setDraft] = useState(emptyDraft);
  const replacing = vm.record !== null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Logistics completion</p>
          <h2 className="text-lg font-black">Asset returns and site clearance</h2>
        </div>
        {vm.record ? (
          <span className="text-sm text-muted-foreground">
            Recorded {formatPortalDateTime(vm.record.recordedAt)} · revision {vm.record.revision}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        PMCM-only record. It clears the logistics close gate. Private notes stay inside PMCM and are never shown to clients or suppliers.
      </p>
      {vm.error ? <p className="mt-3 text-sm text-attention">{vm.error}</p> : null}
      {vm.loaded ? (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void vm.submit(draft).then(() => setDraft((current) => ({ ...current, correctionReason: "" })));
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.assetReturnsVerified} onChange={(event) => setDraft((current) => ({ ...current, assetReturnsVerified: event.target.checked }))} />
            All assets and equipment returns verified
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Completion summary
            <textarea
              value={draft.completionSummary}
              onChange={(event) => setDraft((current) => ({ ...current, completionSummary: event.target.value }))}
              className="min-h-20 rounded-md border border-border bg-background p-2 text-sm font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Private PMCM notes
            <textarea
              value={draft.privateNotes}
              onChange={(event) => setDraft((current) => ({ ...current, privateNotes: event.target.value }))}
              className="min-h-20 rounded-md border border-border bg-background p-2 text-sm font-normal"
            />
          </label>
          {replacing ? (
            <label className="grid gap-1 text-sm font-semibold">
              Correction reason
              <input
                value={draft.correctionReason}
                onChange={(event) => setDraft((current) => ({ ...current, correctionReason: event.target.value }))}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm font-normal"
              />
            </label>
          ) : null}
          <div>
            <button type="submit" disabled={vm.busy} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {replacing ? "Record correction" : "Record logistics completion"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
