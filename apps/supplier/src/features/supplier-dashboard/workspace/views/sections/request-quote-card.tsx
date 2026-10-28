"use client";

import { FormEvent } from "react";
import { Clock3, LockKeyhole, Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  closedRequestReason,
  formatDate,
  formatMoney,
  fmt,
  initialForm,
  isPastDate,
  isRequestClosed,
} from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, QuoteFormState } from "../../model/supplier-workspace-types";
import { Card, CardBody, CardHeader } from "./shell-ui";

function quoteFormTitle(closed: boolean, hasQuote: boolean) {
  if (closed) return "Quote on file (read-only)";
  if (hasQuote) return "Revise your quote";
  return "Submit your quote";
}

function quoteFormHint(closed: boolean, hasQuote: boolean) {
  if (closed) return "Locked after selection or closure.";
  if (hasQuote) return "Sending a revision replaces your current offer as the one PMCM evaluates. Earlier versions stay on record.";
  return "Review your amount, scope and payment terms before sending. PMCM will review your offer; this does not confirm a booking.";
}

function quoteSubmitLabel(sending: boolean, hasQuote: boolean) {
  if (sending) return "Sending quote…";
  return hasQuote ? "Send revision to PMCM" : "Send quote to PMCM";
}

function QuoteSummary({ quote }: { quote: PrismSupplierQuote }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
      {[{ label: "Amount", value: formatMoney(quote.amount) }, { label: "Revision", value: `#${quote.revisionNumber ?? 1}` }, { label: "Status", value: fmt(quote.status) }].map(({ label, value }) => (
        <div key={label} className="min-w-0 px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold capitalize tabular-nums text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function RequestQuoteCard({
  req,
  quote,
  form,
  busy,
  onUpdateForm,
  onSubmitQuote,
  embedded = false,
}: {
  embedded?: boolean;
  req: PrismSupplierQuoteRequest;
  quote?: PrismSupplierQuote;
  form: QuoteFormState;
  busy: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  const closed = isRequestClosed(req, quote);
  const deadlinePast = isPastDate(req.dueDate) && !closed;
  const quoteStatus = quote?.status ?? req.status;
  const closedReason = closedRequestReason(req, quote);

  return (
    <Card className={embedded ? "rounded-none rounded-b-lg border-x-0 border-b-0" : ""}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{req.category}</h3>
              {closed ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="size-3" aria-hidden="true" /> Locked</span> : null}
              {req.confidentialBid ? <span className="text-xs text-muted-foreground">Confidential bid</span> : null}
            </div>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Request {req.id}</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{req.message}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${deadlinePast ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground"}`}>
              <Clock3 className="size-3.5" />
              {deadlinePast ? "Past deadline" : "Due"}: {formatDate(req.dueDate)}
            </span>
            <StatusBadge status={quoteStatus} />
          </div>
        </div>
      </CardHeader>

      {quote ? <QuoteSummary quote={quote} /> : null}

      {closed ? (
        <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-6">
          <p className="text-xs leading-5 text-muted-foreground">{closedReason}</p>
        </div>
      ) : null}

      <CardBody>
        <form onSubmit={(ev) => onSubmitQuote(ev, req)} className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{quoteFormTitle(closed, Boolean(quote))}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {quoteFormHint(closed, Boolean(quote))}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Quote amount (PHP)
              <Input disabled={closed} value={form.amount} onChange={(e) => onUpdateForm(req.id, { amount: e.target.value })} type="number" min="1" className="h-11 rounded-md" placeholder="75000" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Payment terms
              <Input disabled={closed} value={form.paymentTerms} onChange={(e) => onUpdateForm(req.id, { paymentTerms: e.target.value })} className="h-11 rounded-md" placeholder="Describe your proposed payment schedule" />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Inclusions (one per line)
            <textarea disabled={closed} value={form.inclusions} onChange={(e) => onUpdateForm(req.id, { inclusions: e.target.value })} rows={3}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Ingress crew, lights, operator…" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Notes
            <textarea disabled={closed} value={form.notes} onChange={(e) => onUpdateForm(req.id, { notes: e.target.value })} rows={2}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Availability notes, exclusions, setup assumptions…" />
          </label>
          {closed ? null : (
            <Button type="submit" disabled={busy === req.id} className="h-11 w-full rounded-md font-semibold sm:w-auto">
              <Send className="size-4" />{quoteSubmitLabel(busy === req.id, Boolean(quote))}
            </Button>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
