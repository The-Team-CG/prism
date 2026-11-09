"use client";

import { FormEvent } from "react";
import { LockKeyhole, Send } from "lucide-react";
import type { PrismSupplierQuoteForSupplier } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { closedRequestReason, formatMoney, isQuoteLocked, statusLabel } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, QuoteFormState } from "../../model/supplier-workspace-types";

function quoteSubmitLabel(sending: boolean, hasQuote: boolean) {
  if (sending) return "Sending quote…";
  return hasQuote ? "Send revision to PMCM" : "Send quote to PMCM";
}

/** A quote that can no longer change reads as a record, never as a greyed-out form. */
export function QuoteReadOnly({ quote }: { quote: PrismSupplierQuoteForSupplier }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-3">
      <div><dt className="text-muted-foreground">Amount</dt><dd className="mt-0.5 font-semibold tabular-nums text-foreground">{formatMoney(quote.amount)}</dd></div>
      <div><dt className="text-muted-foreground">Revision</dt><dd className="mt-0.5 text-foreground">{quote.revisionNumber ?? 1}</dd></div>
      <div><dt className="text-muted-foreground">Status</dt><dd className="mt-0.5 text-foreground">{statusLabel(quote.status)}</dd></div>
      <div className="sm:col-span-3"><dt className="text-muted-foreground">Payment terms</dt><dd className="mt-0.5 break-words text-foreground">{quote.paymentTerms || "—"}</dd></div>
      <div className="sm:col-span-3">
        <dt className="text-muted-foreground">Inclusions</dt>
        <dd className="mt-0.5 text-foreground">
          {quote.inclusions.length ? <ul className="list-disc space-y-0.5 pl-5">{quote.inclusions.map((item) => <li key={item} className="break-words">{item}</li>)}</ul> : "—"}
        </dd>
      </div>
      {quote.notes ? <div className="sm:col-span-3"><dt className="text-muted-foreground">Notes</dt><dd className="mt-0.5 break-words text-foreground">{quote.notes}</dd></div> : null}
    </dl>
  );
}

export function RequestQuoteCard({
  req,
  quote,
  form,
  busy,
  onUpdateForm,
  onSubmitQuote,
}: {
  req: PrismSupplierQuoteRequest;
  quote?: PrismSupplierQuote;
  form: QuoteFormState;
  busy: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  const locked = isQuoteLocked(req, quote);
  const hasQuote = Boolean(quote);

  return (
    <div className="border-t border-border px-4 py-5 sm:px-6">
      {req.message ? <p className="max-w-3xl text-sm leading-6 text-foreground">{req.message}</p> : null}
      {req.confidentialBid ? <p className="mt-1 text-xs text-muted-foreground">Confidential bid: the client and event name are shared if PMCM selects your quote.</p> : null}

      {locked ? (
        <div className="mt-4 space-y-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{closedRequestReason(req, quote)}</p>
          {quote ? <QuoteReadOnly quote={quote} /> : null}
        </div>
      ) : (
        <form onSubmit={(ev) => onSubmitQuote(ev, req)} className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{hasQuote ? "Revise your quote" : "Submit your quote"}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {hasQuote
                ? "You can revise once. A revision replaces your current offer as the one PMCM evaluates; earlier versions stay on record."
                : "Review your amount, scope and payment terms before sending. PMCM will review your offer; this does not confirm a booking."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Quote amount (PHP)
              <Input required value={form.amount} onChange={(e) => onUpdateForm(req.id, { amount: e.target.value })} type="number" min="1" step="1" className="h-11 rounded-md" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Payment terms
              <Input value={form.paymentTerms} onChange={(e) => onUpdateForm(req.id, { paymentTerms: e.target.value })} className="h-11 rounded-md" placeholder="Describe your proposed payment schedule" />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Inclusions (one per line)
            <textarea value={form.inclusions} onChange={(e) => onUpdateForm(req.id, { inclusions: e.target.value })} rows={3}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Ingress crew, lights, operator…" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Notes
            <textarea value={form.notes} onChange={(e) => onUpdateForm(req.id, { notes: e.target.value })} rows={2}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Availability notes, exclusions, setup assumptions…" />
          </label>
          <Button type="submit" disabled={busy === req.id} className="h-11 w-full rounded-md font-semibold sm:w-auto">
            <Send className="size-4" />{quoteSubmitLabel(busy === req.id, hasQuote)}
          </Button>
        </form>
      )}
    </div>
  );
}
