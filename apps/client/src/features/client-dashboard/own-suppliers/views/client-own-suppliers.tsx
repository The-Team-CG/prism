"use client";

import { useCallback, useEffect, useState } from "react";
import { createClientOwnedSupplierSchema, parseContract, type PrismClientOwnedSupplier } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { PrismSection } from "@prism/ui/page-blocks";
import { ownSuppliersRepository } from "../data/own-suppliers-repository";

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
    <PrismSection id="client-own-suppliers" title="Your own suppliers" description="Add any supplier you are booking yourself, such as a family photographer or a church choir. Mark it confirmed once they commit, so PMCM can plan around them.">
      {error ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
      {items.length ? (
        <ul className="mb-5 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.supplierName} · {item.category}</p>
                <p className="text-xs text-muted-foreground">{item.status === "confirmed" ? "Confirmed" : "Not confirmed yet"}{item.operationalNotes ? ` · ${item.operationalNotes}` : ""}</p>
                {item.riskWarning ? <p role="status" className="mt-1 text-xs text-destructive">PMCM note: {item.riskWarning}</p> : null}
              </div>
              {item.status !== "confirmed" ? <Button type="button" variant="outline" size="sm" onClick={() => void run(() => ownSuppliersRepository.confirm(eventId, item.id))}>Mark confirmed</Button> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="own-supplier-service">Service</FieldLabel><Input id="own-supplier-service" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="e.g. Photography" /></Field>
        <Field><FieldLabel htmlFor="own-supplier-name">Supplier</FieldLabel><Input id="own-supplier-name" value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} /></Field>
        <Field><FieldLabel htmlFor="own-supplier-contact">Contact (optional)</FieldLabel><Input id="own-supplier-contact" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></Field>
        <Field><FieldLabel htmlFor="own-supplier-notes">Arrival and set-up notes</FieldLabel><Input id="own-supplier-notes" value={form.operationalNotes} onChange={(event) => setForm({ ...form, operationalNotes: event.target.value })} /></Field>
      </div>
      <Button type="button" variant="outline" className="mt-4" disabled={!form.category.trim() || !form.supplierName.trim()} onClick={() => void run(async () => {
        await ownSuppliersRepository.create(eventId, parseContract(createClientOwnedSupplierSchema, form, "Supplier"));
        setForm(empty);
      })}>Add supplier</Button>
    </PrismSection>
  );
}
