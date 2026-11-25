"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import type { PrismAddendum, PrismDocument, PrismEventFreezeException, PrismSupplierQuote } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { Textarea } from "@prism/ui/components/textarea";
import { formatPeso } from "@prism/ui/payment-track";
import { emptyIssueAddendumDraft, issueAddendumProblems, signedWholePesos, type IssueAddendumDraft } from "../model/change-register-rules";

/**
 * "Issue addendum" and the side panel it opens. PMCM writes what the client signs (title, what changes, the contract
 * terms and the signed document) and what it costs (the price change and any supplier amount that moves with it).
 * Issuing records it as pending; the client then signs it and PMCM countersigns.
 */
export function IssueAddendumAction({
  eventId,
  documents,
  bookedQuotes,
  contractTotal,
  approvedExceptions,
  pendingAddendum,
  frozen,
  busy,
  onIssue,
}: {
  eventId: string;
  documents: readonly PrismDocument[];
  bookedQuotes: readonly PrismSupplierQuote[];
  /** What the client's approved billing adds up to today; null before any billing source is approved. */
  contractTotal: number | null;
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
  const delta = signedWholePesos(draft.financialDeltaPesos);

  if (pendingAddendum) {
    return <p className="text-sm text-muted-foreground">Addendum v{pendingAddendum.versionNumber} is waiting to be signed. Countersign or withdraw it before issuing another.</p>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (problems.length) return;
    if (await onIssue(draft)) {
      setDraft(emptyIssueAddendumDraft);
      setOpen(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><FilePlus2 aria-hidden /> Issue addendum</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Issue addendum</SheetTitle>
            <SheetDescription>The client signs it, then you countersign. Billing and supplier amounts change only after both.</SheetDescription>
          </SheetHeader>
          <form aria-label="Issue addendum" onSubmit={submit} className="grid min-w-0 content-start gap-6 px-4 pb-6">
            <FormPart title="What the client signs">
              <Field>
                <FieldLabel htmlFor="addendum-title">Title</FieldLabel>
                <Input id="addendum-title" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="Photo booth added" />
              </Field>
              <Field>
                <FieldLabel htmlFor="addendum-summary">What changes, in the client's words (optional)</FieldLabel>
                <Textarea id="addendum-summary" rows={2} value={draft.summary} onChange={(event) => update("summary", event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="addendum-terms">Contract terms after this addendum</FieldLabel>
                <Textarea id="addendum-terms" rows={3} value={draft.contractTerms} onChange={(event) => update("contractTerms", event.target.value)} placeholder={"Photo booth for 3 hours\nPrinted photo strips for every guest"} />
                <FieldDescription>One term per line. The client sees what was added or removed since the last signed addendum.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="addendum-document">Addendum document</FieldLabel>
                <Select value={draft.documentId} onValueChange={(value) => update("documentId", value)}>
                  <SelectTrigger id="addendum-document" className="w-full min-w-0"><SelectValue placeholder="Choose a file on this event" /></SelectTrigger>
                  <SelectContent>
                    {documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.generatedFileName || document.fileName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {documents.length ? "The signed copy the client agrees to. " : "No files on this event yet. "}
                  <Link className="font-medium text-primary hover:text-primary/80" href={`/dashboard/events/${encodeURIComponent(eventId)}/files`}>Upload it in Files</Link>
                </FieldDescription>
              </Field>
            </FormPart>

            <FormPart title="Money">
              <Field>
                <FieldLabel htmlFor="addendum-delta">Change to the contract price (₱)</FieldLabel>
                <Input id="addendum-delta" inputMode="numeric" value={draft.financialDeltaPesos} onChange={(event) => update("financialDeltaPesos", event.target.value)} placeholder="0" />
                <FieldDescription>{contractTotalLine(contractTotal, delta)}</FieldDescription>
              </Field>
              {bookedQuotes.length ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium text-foreground">Booked supplier amounts</legend>
                  <p className="text-xs text-muted-foreground">Change only the suppliers this addendum changes.</p>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {bookedQuotes.map((quote) => (
                      <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{quote.supplierName}</span>
                          <span className="block text-xs text-muted-foreground">{quote.category} · now {formatPeso(quote.amount)}</span>
                        </span>
                        <Input
                          inputMode="numeric"
                          aria-label={`New amount for ${quote.supplierName}`}
                          value={draft.quoteAmounts[quote.id] ?? ""}
                          onChange={(event) => update("quoteAmounts", { ...draft.quoteAmounts, [quote.id]: event.target.value })}
                          placeholder="Unchanged"
                          className="w-32"
                        />
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ) : null}
              {frozen ? (
                <Field>
                  <FieldLabel htmlFor="addendum-exception">Approved freeze exception</FieldLabel>
                  <Select value={draft.freezeExceptionId} onValueChange={(value) => update("freezeExceptionId", value)}>
                    <SelectTrigger id="addendum-exception" className="w-full min-w-0"><SelectValue placeholder="Choose an exception" /></SelectTrigger>
                    <SelectContent>
                      {approvedExceptions.map((exception) => <SelectItem key={exception.id} value={exception.id}>{exception.requestedChange}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Scope is frozen, so this addendum uses one approved exception.</FieldDescription>
                </Field>
              ) : null}
            </FormPart>

            <Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy || problems.length > 0}>{busy ? "Issuing…" : "Issue addendum"}</Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
              {problems.length ? <FieldDescription>{problems[0]}</FieldDescription> : null}
            </Field>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FormPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** "Contract total ₱100,000 → ₱115,000 once countersigned." Says nothing about a total that is not known yet. */
function contractTotalLine(contractTotal: number | null, delta: number): string {
  if (Number.isNaN(delta)) return "Whole pesos; put a minus sign in front to take money off.";
  if (contractTotal === null) return "Whole pesos; put a minus sign in front to take money off. A price change needs an approved billing source.";
  if (delta === 0) return `Contract total stays ${formatPeso(contractTotal)}.`;
  return `Contract total ${formatPeso(contractTotal)} → ${formatPeso(contractTotal + delta)} once countersigned.`;
}
