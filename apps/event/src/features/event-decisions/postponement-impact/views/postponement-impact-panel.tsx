"use client";

import { usePostponementImpactViewModel } from "../view-models/use-postponement-impact-view-model";
import { rescheduleDateLabel } from "../model/postponement-impact-rules";

export function PostponementImpactPanel({ eventId }: { eventId: string }) {
  const vm = usePostponementImpactViewModel(eventId);

  return (
    <section aria-labelledby="postponement-impact-heading" className="rounded-xl border border-border bg-card p-5">
      <header>
        <h2 id="postponement-impact-heading" className="text-base font-bold text-foreground">Coordinator availability after postponement</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review the recorded coordinator conflict check for the latest event date change.</p>
      </header>

      {vm.status === "loading" ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading postponement impact…</p> : null}
      {vm.status === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">{vm.error}</p>
          <button type="button" onClick={() => void vm.reload()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold">Retry</button>
        </div>
      ) : null}
      <RecordedPostponementImpact vm={vm} />
    </section>
  );
}

function RecordedPostponementImpact({ vm }: { vm: ReturnType<typeof usePostponementImpactViewModel> }) {
  if (vm.status !== "ready") return null;
  const snapshot = vm.effectiveSnapshot?.snapshotDecision;
  const reschedule = snapshot?.assignmentImpact.reschedule;
  const conflicts = reschedule?.conflicts ?? [];

  return <>
      {!vm.effectiveSnapshot ? (
        <p className="mt-4 text-sm text-muted-foreground">No coordinator conflict snapshot is recorded for this event.</p>
      ) : null}
      {vm.effectiveSnapshot?.dateNeedsConfirmation ? (
        <p className="mt-4 rounded-lg bg-attention-soft p-3 text-sm text-attention dark:bg-amber-950/30 dark:text-amber-200">
          The event date is still being confirmed. This conflict snapshot was recorded for {reschedule ? rescheduleDateLabel(reschedule.toDate) : "the prior rescheduled date"}; recheck coordinator availability after the date is confirmed.
        </p>
      ) : null}
      {snapshot && !reschedule ? (
        <p className="mt-4 text-sm text-muted-foreground">No coordinators were retained on a changed event date.</p>
      ) : null}
      {reschedule ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Date checked: {rescheduleDateLabel(reschedule.toDate)}</p>
          {conflicts.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">No booking or declared-availability conflicts were found in the snapshot for coordinators kept on this date.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">These conflicts were recorded when the event date changed. Confirm current availability with each coordinator, then update staffing if a replacement is needed.</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {conflicts.map((conflict) => (
                  <li key={conflict.assignmentId} className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div>
                      <p className="font-semibold text-foreground">{conflict.coordinatorName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {conflict.reason === "double_booking"
                          ? `Already assigned to ${conflict.conflictEventName || "another event"} on that date.`
                          : "Declared unavailable on that date."}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-attention dark:text-amber-300">Conflict recorded</span>
                  </li>
                ))}
              </ul>
              <a href="#coordinator-assignment-desk" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">Review assignments in the coordinator desk</a>
            </>
          )}
        </div>
      ) : null}
  </>;
}
