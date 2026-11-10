"use client";

import { usePendingAddendaViewModel } from "../view-models/use-pending-addenda-view-model";

/** Shows addenda whose billing or quote effect waits for PMCM countersignature, so the totals below are not read as final. */
export function PendingAddendaNote({ eventId }: { eventId: string }) {
  const vm = usePendingAddendaViewModel(eventId);
  if (vm.lines.length === 0) return null;
  return (
    <section aria-labelledby="pending-addenda-note" className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
      <h2 id="pending-addenda-note" className="font-semibold">Pending addenda</h2>
      <p className="text-muted-foreground">The totals below include only countersigned addenda. Pending addenda change them when countersigned.</p>
      <ul className="list-disc space-y-1 pl-5">
        {vm.lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </section>
  );
}
