"use client";

import { useState } from "react";
import { PhoneIncoming } from "lucide-react";
import type { AddSupplierQuoteInput } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { Textarea } from "@prism/ui/components/textarea";
import { formatPortalDate } from "@prism/ui/format-date";
import type { SupplierQuoteRequestRow, SupplierQuoteRow } from "@/features/pmcm-kit";
import { requestsAwaitingQuote, type LoggedQuoteDraft } from "../model/suppliers-directory-rules";
import { loggedSupplierQuote } from "../use-cases/log-supplier-quote";

const EMPTY: LoggedQuoteDraft = { amount: "", inclusions: "", paymentTerms: "", notes: "" };

/**
 * Suppliers asked for a quote who have not sent one through their link. When one answers by phone or email, PMCM logs
 * the quote here and it joins the comparison like any other.
 */
export function AwaitingQuotes({ requests, quotes, busy, onLogQuote }: { requests: readonly SupplierQuoteRequestRow[]; quotes: readonly SupplierQuoteRow[]; busy: boolean; onLogQuote: (input: AddSupplierQuoteInput) => Promise<boolean> }) {
  const waiting = requestsAwaitingQuote(requests, quotes);
  const [logging, setLogging] = useState<SupplierQuoteRequestRow | null>(null);
  if (!waiting.length) return null;
  return (
    <section aria-labelledby="awaiting-quotes-title" className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 id="awaiting-quotes-title" className="text-sm font-semibold text-foreground">Waiting for quotes <span className="font-normal tabular-nums text-muted-foreground">{waiting.length}</span></h3>
        <p className="text-xs text-muted-foreground">Answered by phone or email? Log it so it joins the comparison.</p>
      </header>
      <ul className="divide-y divide-border">
        {waiting.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{request.supplierName}</span>
              <span className="block text-xs text-muted-foreground">Asked {formatPortalDate(request.createdAt)} · {request.dueDate ? `due ${formatPortalDate(request.dueDate)}` : "no deadline"}</span>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setLogging(request)} aria-label={`Log a quote from ${request.supplierName}`}>
              <PhoneIncoming aria-hidden /> Log a quote
            </Button>
          </li>
        ))}
      </ul>
      <LogQuoteSheet request={logging} busy={busy} onClose={() => setLogging(null)} onLogQuote={onLogQuote} />
    </section>
  );
}

function LogQuoteSheet({ request, busy, onClose, onLogQuote }: { request: SupplierQuoteRequestRow | null; busy: boolean; onClose: () => void; onLogQuote: (input: AddSupplierQuoteInput) => Promise<boolean> }) {
  const [draft, setDraft] = useState<LoggedQuoteDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof LoggedQuoteDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  function close() {
    setDraft(EMPTY);
    setError(null);
    onClose();
  }
  async function save() {
    if (!request) return;
    try {
      setError(null);
      if (await onLogQuote(loggedSupplierQuote(request, draft))) close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The quote could not be logged.");
    }
  }
  return (
    <Sheet open={Boolean(request)} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Log a quote</SheetTitle>
          <SheetDescription>{request ? `${request.supplierName} · ${request.category}` : ""}</SheetDescription>
        </SheetHeader>
        <form aria-label={request ? `Quote from ${request.supplierName}` : "Log a quote"} className="grid min-w-0 content-start gap-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <Field>
            <FieldLabel htmlFor="logged-quote-amount">Amount (PHP)</FieldLabel>
            <Input id="logged-quote-amount" inputMode="numeric" value={draft.amount} onChange={(event) => set("amount", event.target.value)} placeholder="45,000" />
          </Field>
          <Field>
            <FieldLabel htmlFor="logged-quote-inclusions">Inclusions, one per line</FieldLabel>
            <Textarea id="logged-quote-inclusions" rows={3} value={draft.inclusions} onChange={(event) => set("inclusions", event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="logged-quote-terms">Payment terms</FieldLabel>
            <Input id="logged-quote-terms" value={draft.paymentTerms} onChange={(event) => set("paymentTerms", event.target.value)} placeholder="50% down payment" />
          </Field>
          <Field>
            <FieldLabel htmlFor="logged-quote-notes">How it arrived (optional)</FieldLabel>
            <Input id="logged-quote-notes" value={draft.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Emailed by the supplier on Nov 20" />
            <FieldDescription>Kept with the quote so the comparison shows where it came from.</FieldDescription>
          </Field>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !draft.amount.trim()}>Save quote</Button>
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
