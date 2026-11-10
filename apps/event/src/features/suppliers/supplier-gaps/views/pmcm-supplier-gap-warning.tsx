"use client";

import { Button } from "@prism/ui/components/button";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { useSupplierGaps } from "../view-models/use-supplier-gaps";

/** FR-63: shown only when a requested category has no available Tier 1 or Tier 2 supplier on the event date. */
export function PmcmSupplierGapWarning({ eventId, refreshKey }: { eventId: string; refreshKey?: string }) {
  const vm = useSupplierGaps(eventId, refreshKey);
  if (vm.gaps.length === 0 && !vm.error) return null;
  return (
    <section role="alert" aria-labelledby="supplier-gap-heading" className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <h2 id="supplier-gap-heading" className="text-sm font-semibold text-destructive">Supplier gap</h2>
      <p className="mt-1 text-xs text-muted-foreground">No Tier 1 or Tier 2 supplier is available on the event date for these categories. Event day cannot start until a supplier is booked or PMCM acknowledges the risk.</p>
      {vm.error ? <p className="mt-2 text-sm text-destructive">{vm.error}</p> : null}
      <ul className="mt-3 space-y-3">
        {vm.gaps.map((gap) => (
          <li key={gap.categoryId} className="rounded-md border border-border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">{gap.categoryName}</p>
            {gap.acknowledgement ? (
              <p className="mt-1 text-xs text-muted-foreground">Risk acknowledged by {gap.acknowledgement.acknowledgedBy} on {formatPortalDateTime(gap.acknowledgement.acknowledgedAt)}: {gap.acknowledgement.reason}</p>
            ) : (
              <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void vm.acknowledge(gap.categoryId); }}>
                <label className="grow text-xs font-semibold text-muted-foreground">Reason for proceeding
                  <input value={vm.reasons[gap.categoryId] ?? ""} maxLength={500} onChange={(event) => vm.setReason(gap.categoryId, event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
                </label>
                <Button type="submit" variant="outline" disabled={vm.busy === gap.categoryId || !(vm.reasons[gap.categoryId] ?? "").trim()}>{vm.busy === gap.categoryId ? "Saving…" : "Acknowledge risk"}</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
