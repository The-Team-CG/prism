"use client";

import { useState, type FormEvent } from "react";
import type { PrismAddendum, PrismDocument, PrismEventFreezeException, PrismSupplierQuote } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPeso } from "@prism/ui/payment-track";
import { emptyIssueAddendumDraft, issueAddendumProblems, type IssueAddendumDraft } from "../model/change-register-rules";

const FIELD = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/**
 * PMCM writes an addendum: what changes in the contract, what it adds to or takes off the price, and any supplier
 * amount that changes with it. Issuing records it as pending; the client then signs it and PMCM countersigns.
 */
export function IssueAddendumForm({
  documents,
  bookedQuotes,
  approvedExceptions,
  pendingAddendum,
  frozen,
  busy,
  onIssue,
}: {
  documents: readonly PrismDocument[];
  bookedQuotes: readonly PrismSupplierQuote[];
  approvedExceptions: readonly PrismEventFreezeException[];
  pendingAddendum: PrismAddendum | null;
  frozen: boolean;
  busy: boolean;
  onIssue: (draft: IssueAddendumDraft) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<IssueAddendumDraft>(emptyIssueAddendumDraft);
  const update = <K extends keyof IssueAddendumDraft>(key: K, value: IssueAddendumDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const problems = issueAddendumProblems(draft, bookedQuotes, frozen);

  if (pendingAddendum) {
    return <p className="text-sm text-muted-foreground">Addendum v{pendingAddendum.versionNumber} is waiting to be signed. Countersign or withdraw it before issuing another.</p>;
  }
  if (!open) {
    return <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Issue addendum</Button>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onIssue(draft)) {
      setDraft(emptyIssueAddendumDraft);
      setOpen(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Issue addendum" className="space-y-3 rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold text-foreground">Issue addendum</h4>
      <label className="block text-sm">
        <span className="text-muted-foreground">Title</span>
        <input value={draft.title} onChange={(event) => update("title", event.target.value)} className={FIELD} placeholder="Photo booth added" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">What changes, for the client (optional)</span>
        <textarea rows={2} value={draft.summary} onChange={(event) => update("summary", event.target.value)} className={FIELD} />
      </label>
      <div className="block text-sm">
        <span id="addendum-document-label" className="text-muted-foreground">Addendum document</span>
        <Select value={draft.documentId} onValueChange={(value) => update("documentId", value)}>
          <SelectTrigger aria-labelledby="addendum-document-label" className="mt-1 w-full min-w-0"><SelectValue placeholder="Choose a file on this event" /></SelectTrigger>
          <SelectContent>
            {documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.generatedFileName || document.fileName}</SelectItem>)}
          </SelectContent>
        </Select>
        {documents.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Upload the addendum document in this event's Files first.</p> : null}
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">Contract terms after this addendum, one per line</span>
        <textarea rows={3} value={draft.contractTerms} onChange={(event) => update("contractTerms", event.target.value)} className={FIELD} placeholder={"Photo booth for 3 hours\nPrinted photo strips for every guest"} />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Change to the contract price (₱, negative to reduce)</span>
        <input inputMode="numeric" value={draft.financialDeltaPesos} onChange={(event) => update("financialDeltaPesos", event.target.value)} className={FIELD} placeholder="0" />
      </label>
      {bookedQuotes.length ? (
        <fieldset className="space-y-2 text-sm">
          <legend className="text-muted-foreground">Booked supplier amounts (change only what this addendum changes)</legend>
          {bookedQuotes.map((quote) => (
            <label key={quote.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate">{quote.supplierName} · {quote.category} · now {formatPeso(quote.amount)}</span>
              <input
                inputMode="numeric"
                aria-label={`New amount for ${quote.supplierName}`}
                value={draft.quoteAmounts[quote.id] ?? ""}
                onChange={(event) => update("quoteAmounts", { ...draft.quoteAmounts, [quote.id]: event.target.value })}
                placeholder={String(quote.amount)}
                className="w-36 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </label>
          ))}
        </fieldset>
      ) : null}
      {frozen ? (
        <div className="block text-sm">
          <span id="addendum-exception-label" className="text-muted-foreground">Approved freeze exception</span>
          <Select value={draft.freezeExceptionId} onValueChange={(value) => update("freezeExceptionId", value)}>
            <SelectTrigger aria-labelledby="addendum-exception-label" className="mt-1 w-full min-w-0"><SelectValue placeholder="Choose an exception" /></SelectTrigger>
            <SelectContent>
              {approvedExceptions.map((exception) => <SelectItem key={exception.id} value={exception.id}>{exception.requestedChange}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {problems.length ? <p className="text-xs text-muted-foreground">{problems[0]}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || problems.length > 0}>{busy ? "Issuing…" : "Issue addendum"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <p className="text-xs text-muted-foreground">It stays pending until the client signs and PMCM countersigns; only then do the price and supplier amounts change.</p>
    </form>
  );
}
