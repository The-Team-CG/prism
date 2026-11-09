"use client";

import type { FormEvent } from "react";
import type { PrismSupplierQuoteRequestTokenDetail } from "@prism/types";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Textarea } from "@prism/ui/components/textarea";
import { SUPPLIER_PORTAL_POINTS, SUPPLIER_PORTAL_STATEMENT } from "@/features/supplier-auth/sign-in/model/supplier-portal-copy";
import { closedRequestReason, formatMoney, isQuoteLocked } from "@/features/supplier-dashboard/workspace/model/supplier-workspace-rules";
import { QuoteReadOnly } from "@/features/supplier-dashboard/workspace/views/sections/request-quote-card";
import { useSupplierQuoteLinkViewModel } from "../view-models/use-supplier-quote-link-view-model";

export function SupplierQuoteLinkView({ token }: { token: string }) {
  const vm = useSupplierQuoteLinkViewModel(token);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={SUPPLIER_PORTAL_STATEMENT}
      points={SUPPLIER_PORTAL_POINTS}
      title={vm.detail?.eventName ?? "Quote request"}
      description={vm.detail ? `${vm.detail.request.category}${vm.detail.eventDate ? ` · ${formatPortalDate(vm.detail.eventDate)}` : ""}` : undefined}
    >
      {vm.error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      {vm.complete ? (
        <p role="status" className="text-base font-medium text-foreground">Your quote has been sent to PMCM for review.</p>
      ) : vm.loading ? (
        <p className="text-base text-muted-foreground" role="status">Loading secure quote request…</p>
      ) : vm.detail ? (
        <>
          <QuoteRequestContext detail={vm.detail} />
          <QuoteLinkForm vm={vm} onSubmit={submit} />
        </>
      ) : null}
    </PrismAuthShell>
  );
}

type QuoteLinkVm = ReturnType<typeof useSupplierQuoteLinkViewModel>;

function QuoteRequestContext({ detail }: { detail: PrismSupplierQuoteRequestTokenDetail }) {
  return (
    <dl className="mb-6 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-muted-foreground">Event type</dt>
      <dd className="break-words text-foreground">{detail.eventType}</dd>
      <dt className="text-muted-foreground">Guests</dt>
      <dd className="text-foreground tabular-nums">{detail.guestCount ?? "To be confirmed"}</dd>
      <dt className="text-muted-foreground">Venue type</dt>
      <dd className="text-foreground">{detail.venueType ?? "To be confirmed"}</dd>
      <dt className="text-muted-foreground">Service requirements</dt>
      <dd className="break-words text-foreground">{detail.serviceRequirements.length > 0 ? detail.serviceRequirements.join(", ") : "None listed"}</dd>
    </dl>
  );
}

function QuoteLinkForm({ vm, onSubmit }: { vm: QuoteLinkVm; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const detail = vm.detail;
  if (!detail) return null;
  if (isQuoteLocked(detail.request, detail.quote)) {
    return (
      <div className="flex flex-col gap-5">
        {detail.request.message ? <p className="text-sm leading-6 text-muted-foreground">{detail.request.message}</p> : null}
        <p role="status" className="text-base font-medium text-foreground">{closedRequestReason(detail.request, detail.quote)}</p>
        {detail.quote ? <QuoteReadOnly quote={detail.quote} /> : null}
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {detail.request.message ? <p className="text-sm leading-6 text-muted-foreground">{detail.request.message}</p> : null}
      <FieldDescription>Quote due {formatPortalDateTime(detail.request.dueDate, "—")} · Your quote is private to PMCM.</FieldDescription>
      {detail.quote ? (
        <div className="rounded-lg border border-border px-4 py-3 text-sm">
          <p className="text-foreground">
            Current offer: <span className="font-semibold tabular-nums">{formatMoney(detail.quote.amount)}</span> · revision {detail.quote.revisionNumber ?? 1}
          </p>
          <p className="mt-1 text-muted-foreground">You can revise once. A revision replaces this as the offer PMCM evaluates; earlier versions stay on record.</p>
        </div>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="quote-amount">Quote amount (PHP)</FieldLabel>
          <Input
            id="quote-amount"
            required
            type="number"
            min="1"
            step="1"
            value={vm.form.amount}
            onChange={(e) => vm.update({ amount: e.target.value })}
            className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-inclusions">Inclusions, one per line</FieldLabel>
          <Textarea
            id="quote-inclusions"
            rows={4}
            value={vm.form.inclusions}
            onChange={(e) => vm.update({ inclusions: e.target.value })}
            className={`rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-payment-terms">Payment terms</FieldLabel>
          <Input
            id="quote-payment-terms"
            value={vm.form.paymentTerms}
            onChange={(e) => vm.update({ paymentTerms: e.target.value })}
            className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quote-notes">Notes</FieldLabel>
          <Textarea
            id="quote-notes"
            rows={3}
            value={vm.form.notes}
            onChange={(e) => vm.update({ notes: e.target.value })}
            className={`rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={vm.busy} className={prismAuthSubmitClassName("supplier")}>
        {vm.busy ? "Sending…" : detail.quote ? "Send revision to PMCM" : "Send quote to PMCM"}
      </Button>
    </form>
  );
}
