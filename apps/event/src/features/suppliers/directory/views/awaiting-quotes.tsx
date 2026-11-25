"use client";

import { useState } from "react";
import type { AddSupplierQuoteInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { formatPortalDate } from "@prism/ui/format-date";
import type { SupplierQuoteRequestRow, SupplierQuoteRow } from "@/features/pmcm-kit";
import { requestsAwaitingQuote, type LoggedQuoteDraft } from "../model/suppliers-directory-rules";
import { loggedSupplierQuote } from "../use-cases/log-supplier-quote";

const EMPTY: LoggedQuoteDraft = { amount: "", inclusions: "", paymentTerms: "", notes: "" };
const FIELD = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/**
 * Suppliers asked for a quote who have not sent one through their link. When one answers by phone or email, PMCM logs
 * the quote here so it joins the comparison like any other.
 */
export function AwaitingQuotes({ requests, quotes, busy, onLogQuote }: { requests: readonly SupplierQuoteRequestRow[]; quotes: readonly SupplierQuoteRow[]; busy: boolean; onLogQuote: (input: AddSupplierQuoteInput) => Promise<boolean> }) {
  const waiting = requestsAwaitingQuote(requests, quotes);
  if (!waiting.length) return null;
  return (
    <section aria-labelledby="awaiting-quotes-title" className="rounded-lg border border-border bg-card p-4">
      <h3 id="awaiting-quotes-title" className="text-sm font-semibold text-foreground">Waiting for quotes <span className="font-normal text-muted-foreground">{waiting.length}</span></h3>
      <ul className="mt-2 divide-y divide-border">
        {waiting.map((request) => <AwaitingRow key={request.id} request={request} busy={busy} onLogQuote={onLogQuote} />)}
      </ul>
    </section>
  );
}

function AwaitingRow({ request, busy, onLogQuote }: { request: SupplierQuoteRequestRow; busy: boolean; onLogQuote: (input: AddSupplierQuoteInput) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LoggedQuoteDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof LoggedQuoteDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    try {
      setError(null);
      if (await onLogQuote(loggedSupplierQuote(request, draft))) { setOpen(false); setDraft(EMPTY); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The quote could not be logged.");
    }
  }
  return (
    <li className="py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{request.supplierName}</span>
          <span className="block text-xs text-muted-foreground">{request.dueDate ? `Due ${formatPortalDate(request.dueDate)}` : "No deadline"}</span>
        </span>
        {open ? null : <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={`Log a quote from ${request.supplierName}`}>Log a quote</Button>}
      </div>
      {open ? (
        <div role="group" aria-label={`Quote from ${request.supplierName}`} className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block">Amount (PHP)<input inputMode="numeric" value={draft.amount} onChange={(event) => set("amount", event.target.value)} className={FIELD} /></label>
          <label className="block">Payment terms<input value={draft.paymentTerms} onChange={(event) => set("paymentTerms", event.target.value)} className={FIELD} /></label>
          <label className="block sm:col-span-2">Inclusions, one per line<textarea rows={2} value={draft.inclusions} onChange={(event) => set("inclusions", event.target.value)} className={FIELD} /></label>
          <label className="block sm:col-span-2">How it arrived (optional)<input value={draft.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Emailed by the supplier on Nov 20" className={FIELD} /></label>
          {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" disabled={busy || !draft.amount.trim()} onClick={() => void save()}>Save quote</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
