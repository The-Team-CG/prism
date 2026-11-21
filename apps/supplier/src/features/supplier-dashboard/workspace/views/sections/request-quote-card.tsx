"use client";

import { FormEvent } from "react";
import { LockKeyhole, Send } from "lucide-react";
import type { PrismSupplierQuoteForSupplier } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { cn } from "@/app/components/ui/utils";
import { closedRequestReason, formatMoney, isQuoteLocked, statusLabel } from "../../model/supplier-workspace-rules";
import { COMMON_PAYMENT_TERMS } from "../../model/request-cards";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, QuoteFormState } from "../../model/supplier-workspace-types";

function quoteSubmitLabel(sending: boolean, hasQuote: boolean) {
  if (sending) return "Sending quote…";
  return hasQuote ? "Send revision to PMCM" : "Send quote to PMCM";
}

const TEXTAREA = "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

/** A quote that can no longer change reads as a record, never as a greyed-out form. */
export function QuoteReadOnly({ quote }: { quote: PrismSupplierQuoteForSupplier }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-3">
      <div><dt className="text-muted-foreground">Amount</dt><dd className="mt-0.5 font-semibold tabular-nums text-foreground">{formatMoney(quote.amount)}</dd></div>
      <div><dt className="text-muted-foreground">Version</dt><dd className="mt-0.5 text-foreground">{(quote.revisionNumber ?? 1) > 1 ? "Revised" : "First quote"}</dd></div>
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

/** "₱420,000" under the amount box, so a missing or extra zero shows before the quote goes out. */
function amountEcho(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? formatMoney(value) : null;
}

/**
 * The quote itself: what PMCM asked for, then the form (or the sent quote once it can no longer change). Common
 * payment terms fill in with one tap, the amount reads back in pesos, and the deadline sits beside the send button.
 */
export function RequestQuoteCard({
  req,
  quote,
  form,
  busy,
  deadline,
  onUpdateForm,
  onSubmitQuote,
}: {
  req: PrismSupplierQuoteRequest;
  quote?: PrismSupplierQuote;
  form: QuoteFormState;
  busy: string | null;
  /** "Due in 3 days", shown beside the send button. */
  deadline?: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  const locked = isQuoteLocked(req, quote);
  const hasQuote = Boolean(quote);
  const echo = amountEcho(form.amount);

  return (
    <div className="grid gap-5">
      <section aria-labelledby={`brief-${req.id}`} className="grid gap-1.5">
        <h3 id={`brief-${req.id}`} className="text-sm font-semibold text-foreground">What PMCM asked for</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{req.message || `A quote for ${req.category}. PMCM did not add a note.`}</p>
        {req.confidentialBid ? <p className="text-xs text-muted-foreground">Confidential bid: the client and event name are shared if PMCM selects your quote.</p> : null}
      </section>

      {locked ? (
        <section aria-label="Your quote" className="grid gap-4 border-t border-border pt-5">
          <p className="flex items-start gap-2 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{closedRequestReason(req, quote)}</p>
          {quote ? <QuoteReadOnly quote={quote} /> : null}
        </section>
      ) : (
        <form onSubmit={(ev) => onSubmitQuote(ev, req)} className="grid gap-4 border-t border-border pt-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{hasQuote ? "Revise your quote" : "Your quote"}</h3>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {hasQuote
                ? "You can revise once. The revision replaces your current offer as the one PMCM reviews; the first version stays on record."
                : "PMCM reviews your offer against the request. Sending a quote does not confirm a booking."}
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Quote amount (PHP)
            <Input required value={form.amount} onChange={(e) => onUpdateForm(req.id, { amount: e.target.value })} type="number" min="1" step="1" inputMode="numeric" className="h-11 rounded-md" />
            <span aria-live="polite" className="text-xs font-normal tabular-nums text-muted-foreground">{echo ? `PMCM will see ${echo}` : "Whole pesos, VAT included if you charge it."}</span>
          </label>
          <div className="grid gap-1.5">
            <label htmlFor={`terms-${req.id}`} className="text-sm font-medium text-foreground">Payment terms</label>
            <Input id={`terms-${req.id}`} value={form.paymentTerms} onChange={(e) => onUpdateForm(req.id, { paymentTerms: e.target.value })} className="h-11 rounded-md" placeholder="How and when PMCM pays you" />
            <div role="group" aria-label="Common payment terms" className="flex flex-wrap gap-1.5">
              {COMMON_PAYMENT_TERMS.map((terms) => (
                <button
                  key={terms}
                  type="button"
                  aria-pressed={form.paymentTerms === terms}
                  onClick={() => onUpdateForm(req.id, { paymentTerms: terms })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    form.paymentTerms === terms ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {terms}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Inclusions, one per line
            <textarea value={form.inclusions} onChange={(e) => onUpdateForm(req.id, { inclusions: e.target.value })} rows={4} className={TEXTAREA} placeholder={"Registration kiosks and printers\nOn-site operator\nIngress crew"} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Notes for PMCM
            <textarea value={form.notes} onChange={(e) => onUpdateForm(req.id, { notes: e.target.value })} rows={2} className={TEXTAREA} placeholder="Availability, exclusions, setup assumptions…" />
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="submit" disabled={busy === req.id} className="h-11 rounded-md font-semibold">
              <Send className="size-4" />{quoteSubmitLabel(busy === req.id, hasQuote)}
            </Button>
            {deadline ? <span className="text-sm text-muted-foreground">{deadline}</span> : null}
          </div>
        </form>
      )}
    </div>
  );
}
