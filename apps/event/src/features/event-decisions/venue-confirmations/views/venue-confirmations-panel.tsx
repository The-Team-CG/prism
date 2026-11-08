"use client";

import { useVenueConfirmations } from "../view-models/use-venue-confirmations";

const STATUS: Record<string, string> = { open: "Waiting for PMCM", confirmed: "Venue confirmed", unavailable: "Venue unavailable" };

/** FR-97: every postponement opens a venue-confirmation sub-ticket for the new (or still unconfirmed) date. */
export function VenueConfirmationsPanel({ eventId }: { eventId: string }) {
  const vm = useVenueConfirmations(eventId);
  if (vm.tasks.length === 0 && !vm.error) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="venue-confirmations-heading">
      <h2 id="venue-confirmations-heading" className="font-semibold text-foreground">Venue confirmation</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Confirm the venue can host the new date. No cancellation fee applies to a postponement; the downpayment carries over.</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      <ul className="mt-3 space-y-3">
        {vm.tasks.map((task) => (
          <li key={task.id} className="rounded-md border border-border p-3 text-sm">
            <p className="font-semibold">{task.newEventDate ? `New date ${task.newEventDate}` : "New date to be confirmed"} · {STATUS[task.status] ?? task.status}</p>
            {task.status === "open" ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="grow text-xs">Note
                  <input value={vm.notes[task.id] ?? ""} maxLength={1000} onChange={(event) => vm.setNote(task.id, event.target.value)} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <button type="button" disabled={vm.busy} onClick={() => void vm.resolve(task.id, "confirmed")} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Venue confirmed</button>
                <button type="button" disabled={vm.busy} onClick={() => void vm.resolve(task.id, "unavailable")} className="rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">Venue unavailable</button>
              </div>
            ) : <p className="mt-1 text-xs text-muted-foreground">{task.resolvedBy}{task.note ? ` · ${task.note}` : ""}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
