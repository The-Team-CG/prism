"use client";

import { useState } from "react";
import type { PrismWrapUpBillingDraftItem, PrismWrapUpSupplierEgressSummary } from "@prism/types";

const MAX_ITEMS = 20;

/** Who has reported leaving, read live from the suppliers' own event-day status. */
export function SupplierEgressSummary({ summary }: { summary?: PrismWrapUpSupplierEgressSummary }) {
  if (!summary) return null;
  if (summary.confirmedSuppliers === 0) return <p className="mt-2 text-xs text-muted-foreground">No confirmed suppliers on this event.</p>;
  return (
    <div className="mt-2 text-xs text-muted-foreground" data-testid="supplier-egress-summary">
      <p>{summary.leftSite} of {summary.confirmedSuppliers} confirmed suppliers reported done and leaving.</p>
      {summary.outstanding.length > 0 ? (
        <p className="mt-1 text-attention">Not reported leaving: {summary.outstanding.join(", ")}. Explain them in the evidence before confirming.</p>
      ) : null}
    </div>
  );
}

/** Additional billing items spotted at wrap-up, kept as a draft for PMCM to bill from the billing panel. */
export function BillingDraftItems({ items, onChange }: { items: PrismWrapUpBillingDraftItem[]; onChange: (items: PrismWrapUpBillingDraftItem[]) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const parsedAmount = Number(amount);
  const canAdd = label.trim().length > 0 && amount.trim() !== "" && Number.isInteger(parsedAmount) && parsedAmount >= 0 && items.length < MAX_ITEMS;

  function add() {
    if (!canAdd) return;
    onChange([...items, { label: label.trim(), amount: parsedAmount, note: "" }]);
    setLabel("");
    setAmount("");
  }

  return (
    <div className="mt-2 space-y-2 text-xs">
      {items.length === 0 ? <p className="text-muted-foreground">No additional billing items drafted.</p> : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span>{item.label} · PHP {item.amount.toLocaleString("en-PH")}</span>
              <button type="button" aria-label={`Remove ${item.label}`} onClick={() => onChange(items.filter((_, position) => position !== index))} className="text-destructive">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
        <input aria-label="Billing item" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Item, e.g. overtime hours" className="rounded-md border border-border bg-background px-2 py-1" />
        <input aria-label="Billing amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" className="rounded-md border border-border bg-background px-2 py-1" />
        <button type="button" disabled={!canAdd} onClick={add} className="rounded-md border border-border px-2 py-1 font-semibold disabled:opacity-60">Add item</button>
      </div>
    </div>
  );
}
