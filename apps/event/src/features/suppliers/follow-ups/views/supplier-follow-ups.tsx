"use client";

import { useCallback, useEffect, useState } from "react";
import { parseContract, raiseClientSupplierRiskSchema, SUPPLIER_RESPONSE_WINDOW_HOURS, type PrismClientOwnedSupplier, type PrismUnresponsiveSupplier } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { supplierFollowUpsRepository } from "../data/supplier-follow-ups-repository";

/** FR-76: suppliers that have not answered a quote request within the response window, with a one-tap Viber follow-up. */
export function UnresponsiveSuppliersPanel({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<PrismUnresponsiveSupplier[]>([]);
  useEffect(() => {
    void supplierFollowUpsRepository.unresponsive(eventId).then(setItems).catch(() => setItems([]));
  }, [eventId]);
  if (items.length === 0) return null;
  return (
    <section role="alert" className="rounded-2xl border border-attention/40 bg-attention/5 p-5 text-sm">
      <h2 className="font-bold">Suppliers not responding</h2>
      <p className="mt-1 text-xs text-muted-foreground">No quote after {SUPPLIER_RESPONSE_WINDOW_HOURS} hours. Backup (Tier 2) suppliers are suggested after a second window.</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.requestId} className="rounded-md border border-border bg-card p-3">
            <p className="font-semibold">{item.supplierName} · {item.category} · {item.hoursWaiting} hours</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
              <a href={`viber://forward?text=${encodeURIComponent(item.draftMessage)}`} className="text-primary">Contact via Viber</a>
              {item.supplierPhone ? <a href={`tel:${item.supplierPhone}`} className="text-primary">Call {item.supplierPhone}</a> : null}
            </div>
            {item.tier2Suggestions.length ? <p className="mt-1 text-xs">Backup suppliers to ask: {item.tier2Suggestions.map((supplier) => supplier.supplierName).join(", ")}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** FR-65: suppliers the client booked directly; PMCM sees operational details only and can raise a risk warning. */
export function ClientOwnedSuppliersPanel({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<PrismClientOwnedSupplier[]>([]);
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setItems(await supplierFollowUpsRepository.clientOwned(eventId)); } catch { setItems([]); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function raise(id: string) {
    setError(null);
    try {
      await supplierFollowUpsRepository.raiseRisk(eventId, id, parseContract(raiseClientSupplierRiskSchema, { warning: warnings[id] ?? "" }, "Risk warning"));
      setWarnings((current) => ({ ...current, [id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the warning.");
    }
  }

  if (items.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 text-sm">
      <h2 className="font-bold">Client-owned suppliers</h2>
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-border p-3">
            <p className="font-semibold">{item.supplierName} · {item.category} · {item.status === "confirmed" ? "confirmed by client" : "not confirmed"}</p>
            {item.operationalNotes ? <p className="text-xs text-muted-foreground">{item.operationalNotes}</p> : null}
            {item.riskWarning ? <p className="text-xs text-destructive">Risk: {item.riskWarning} ({item.riskRaisedBy})</p> : null}
            <div className="mt-2 flex gap-2">
              <input aria-label={`Risk warning for ${item.supplierName}`} value={warnings[item.id] ?? ""} onChange={(event) => setWarnings((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="e.g. No ingress pass yet" className="grow rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <Button type="button" variant="outline" size="sm" disabled={!(warnings[item.id] ?? "").trim()} onClick={() => void raise(item.id)}>Raise risk</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
