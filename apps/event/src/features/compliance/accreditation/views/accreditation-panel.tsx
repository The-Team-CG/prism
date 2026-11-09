"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { ACCREDITATION_SLA_DAYS, ACCREDITATION_STATUSES, createAccreditationRequirementSchema, parseContract, updateAccreditationRequirementSchema, type PrismAccreditationRequirement } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { accreditationRepository } from "../data/accreditation-repository";

type Status = (typeof ACCREDITATION_STATUSES)[number];
const field = "mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

/** FR-70: accreditation documents for large corporate clients, each on its own SLA. Planning continues while they are pending. */
export function AccreditationPanel({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<PrismAccreditationRequirement[]>([]);
  const [name, setName] = useState("");
  const [days, setDays] = useState(String(ACCREDITATION_SLA_DAYS));
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setItems(await accreditationRepository.list(eventId)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load accreditation."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save."); }
  }

  const add = () => run(async () => {
    await accreditationRepository.create(eventId, parseContract(createAccreditationRequirementSchema, { documentName: name, dueInDays: Number(days) }, "Accreditation document"));
    setName("");
  });
  const setStatus = (id: string, status: Status) => run(() => accreditationRepository.update(eventId, id, parseContract(updateAccreditationRequirementSchema, { status }, "Accreditation status")));

  return (
    <section className="rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="text-lg font-bold">Accreditation documents</h2>
      <p className="mt-1 text-muted-foreground">For clients that require agency or supplier accreditation. Each document has its own deadline; planning does not wait for it.</p>
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 ${item.overdue ? "border-destructive/50" : "border-border"}`}>
            <span><span className="font-semibold">{item.documentName}</span> · due {formatPortalDateTime(item.dueAt)}{item.overdue ? " · overdue" : ""}</span>
            <Select value={item.status} onValueChange={(status) => void setStatus(item.id, status as Status)}>
              <SelectTrigger aria-label={`Status of ${item.documentName}`} size="sm" className="min-w-36 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCREDITATION_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grow">Document<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Business permit, SEC registration" className={field} /></label>
        <label>Days to submit<input type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} className={field} /></label>
        <button type="button" disabled={!name.trim()} onClick={() => void add()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Request document</button>
      </div>
    </section>
  );
}
