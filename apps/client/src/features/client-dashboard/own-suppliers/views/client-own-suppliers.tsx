"use client";

import { useCallback, useEffect, useState } from "react";
import { createClientOwnedSupplierSchema, parseContract, type PrismClientOwnedSupplier } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { ownSuppliersRepository } from "../data/own-suppliers-repository";

const field = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const empty = { category: "", supplierName: "", contact: "", operationalNotes: "" };

/** FR-65: suppliers the client books and coordinates directly. The client marks each confirmed; PMCM sees the operational details. */
export function ClientOwnSuppliers({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<PrismClientOwnedSupplier[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await ownSuppliersRepository.list(eventId)); } catch { setItems([]); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save."); }
  }

  return (
    <Card className="gap-2 p-4 text-sm">
      <h3 className="font-bold text-foreground">Your own suppliers</h3>
      <p className="mt-1 text-xs text-muted-foreground">Add any supplier you are booking yourself (for example a family photographer or a church choir). Mark it confirmed once they commit, so PMCM can plan around them.</p>
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-border p-2">
            <p className="font-semibold">{item.supplierName} · {item.category}</p>
            <p className="text-xs text-muted-foreground">{item.status === "confirmed" ? "Confirmed" : "Not confirmed yet"}{item.operationalNotes ? ` · ${item.operationalNotes}` : ""}</p>
            {item.riskWarning ? <p role="status" className="mt-1 text-xs text-destructive">PMCM note: {item.riskWarning}</p> : null}
            {item.status !== "confirmed" ? <Button type="button" variant="outline" className="mt-2 h-8 text-xs" onClick={() => void run(() => ownSuppliersRepository.confirm(eventId, item.id))}>Mark confirmed</Button> : null}
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label>Service<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="e.g. Photography" className={field} /></label>
        <label>Supplier<input value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} className={field} /></label>
        <label>Contact (optional)<input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className={field} /></label>
        <label>Arrival and set-up notes<input value={form.operationalNotes} onChange={(event) => setForm({ ...form, operationalNotes: event.target.value })} className={field} /></label>
      </div>
      <Button type="button" className="mt-3" disabled={!form.category.trim() || !form.supplierName.trim()} onClick={() => void run(async () => {
        await ownSuppliersRepository.create(eventId, parseContract(createClientOwnedSupplierSchema, form, "Supplier"));
        setForm(empty);
      })}>Add supplier</Button>
    </Card>
  );
}
