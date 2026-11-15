"use client";

import { PAYMENT_RECEIPT_EVIDENCE_ACCEPT, PAYMENT_RECEIPT_EVIDENCE_HINT, PAYMENT_RECEIPT_METHODS, type PrismStatementMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { formatPeso } from "@prism/ui/payment-track";
import { owedNow } from "../model/client-money-rules";
import type { ReportPaymentViewModel } from "../view-models/use-report-payment-view-model";

/** Radix selects cannot hold an empty value, so "not sure which payment" is this sentinel. */
const ANY_PAYMENT = "any-payment";

/** "I've paid": the client tells PMCM about a transfer, with proof, so PMCM can check it and apply it. */
export function ReportPaymentDialog({ vm, milestones }: { vm: ReportPaymentViewModel; milestones: PrismStatementMilestone[] }) {
  const open = milestones.filter((milestone) => owedNow(milestone) > 0);
  const { draft, update } = vm;
  return (
    <Dialog open={vm.open} onOpenChange={vm.setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tell PMCM you paid</DialogTitle>
          <DialogDescription>PMCM checks your transfer against their bank or wallet statement, then applies it. You will see it here as being checked until then.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void vm.submit();
          }}
        >
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="report-payment-for">Payment</FieldLabel>
            <Select value={draft.milestoneId || ANY_PAYMENT} onValueChange={(value) => update("milestoneId", value === ANY_PAYMENT ? "" : value)}>
              <SelectTrigger id="report-payment-for" className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {open.map((milestone) => <SelectItem key={milestone.id} value={milestone.id}>{milestone.label} · {formatPeso(owedNow(milestone))} left</SelectItem>)}
                <SelectItem value={ANY_PAYMENT}>Not sure, let PMCM decide</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="report-payment-amount">Amount sent (₱)</FieldLabel>
            <Input id="report-payment-amount" inputMode="numeric" value={draft.amount} onChange={(event) => update("amount", event.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-payment-date">Date sent</FieldLabel>
            <DatePicker id="report-payment-date" aria-label="Date sent" value={draft.paidDate} onValueChange={(value) => update("paidDate", value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-payment-method">Paid by</FieldLabel>
            <Select value={draft.method} onValueChange={(value) => update("method", value)}>
              <SelectTrigger id="report-payment-method" className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_RECEIPT_METHODS.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="report-payment-reference">Reference number</FieldLabel>
            <Input id="report-payment-reference" value={draft.referenceNumber} onChange={(event) => update("referenceNumber", event.target.value)} required />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="report-payment-proof">Proof of payment</FieldLabel>
            <Input id="report-payment-proof" type="file" accept={PAYMENT_RECEIPT_EVIDENCE_ACCEPT} onChange={(event) => update("proof", event.target.files?.[0] ?? null)} required />
            <FieldDescription>{PAYMENT_RECEIPT_EVIDENCE_HINT}</FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="report-payment-note">Note for PMCM (optional)</FieldLabel>
            <Textarea id="report-payment-note" rows={2} maxLength={500} value={draft.note} onChange={(event) => update("note", event.target.value)} />
          </Field>
          {vm.error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{vm.error}</p> : null}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => vm.setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={vm.submitting}>{vm.submitting ? "Sending…" : "Send to PMCM"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
