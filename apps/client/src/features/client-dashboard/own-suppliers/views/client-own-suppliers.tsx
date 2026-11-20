"use client";

import { useCallback, useEffect, useState } from "react";
import { Store } from "lucide-react";
import { createClientOwnedSupplierSchema, parseContract, type PrismClientOwnedSupplier } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { ownSuppliersRepository } from "../data/own-suppliers-repository";

const empty = { category: "", supplierName: "", contact: "", operationalNotes: "" };

/**
 * FR-65: suppliers the client books and coordinates directly, as rows under one heading. The client marks each
 * confirmed; PMCM sees the operational details. Adding one opens a short dialog.
 */
export function ClientOwnSuppliers({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<PrismClientOwnedSupplier[]>([]);
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await ownSuppliersRepository.list(eventId)); } catch { setItems([]); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); await load(); return true; } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save."); return false; }
  }

  return (
    <PrismSection
      id="client-own-suppliers"
      title="Your own suppliers"
      count={items.length || undefined}
      description="Suppliers you book yourself, such as a family photographer. Mark each confirmed once they commit, so PMCM can plan around them."
      headerOutside
      flush={items.length > 0}
      action={<Button type="button" variant="outline" onClick={() => setAdding(true)}>Add supplier</Button>}
    >
      {error && !adding ? <p role="alert" className="px-5 pt-3 text-sm text-destructive">{error}</p> : null}
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.supplierName} <span className="font-normal text-muted-foreground">· {item.category}</span></p>
                <p className="text-xs text-muted-foreground">{item.status === "confirmed" ? "Confirmed" : "Not confirmed yet"}{item.operationalNotes ? ` · ${item.operationalNotes}` : ""}</p>
                {item.riskWarning ? <p role="status" className="mt-1 text-xs text-destructive">PMCM note: {item.riskWarning}</p> : null}
              </div>
              {item.status !== "confirmed" ? (
                <button type="button" className="text-sm font-medium text-primary hover:text-primary/80" onClick={() => void run(() => ownSuppliersRepository.confirm(eventId, item.id))}>Mark confirmed</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <PrismEmptyLine icon={Store}>No suppliers of your own yet. PMCM books the rest.</PrismEmptyLine>
      )}
      <Dialog open={adding} onOpenChange={(open) => { setAdding(open); if (!open) setError(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a supplier you booked</DialogTitle>
            <DialogDescription>PMCM uses this to plan their arrival and set-up.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => ownSuppliersRepository.create(eventId, parseContract(createClientOwnedSupplierSchema, form, "Supplier"))).then((saved) => {
                if (saved) { setForm(empty); setAdding(false); }
              });
            }}
          >
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="own-supplier-service">Service</FieldLabel><Input id="own-supplier-service" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Photography" /></Field>
              <Field><FieldLabel htmlFor="own-supplier-name">Supplier</FieldLabel><Input id="own-supplier-name" value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="own-supplier-contact">Contact (optional)</FieldLabel><Input id="own-supplier-contact" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="own-supplier-notes">Arrival and set-up notes</FieldLabel><Input id="own-supplier-notes" value={form.operationalNotes} onChange={(event) => setForm({ ...form, operationalNotes: event.target.value })} /></Field>
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={!form.category.trim() || !form.supplierName.trim()}>Add supplier</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PrismSection>
  );
}
