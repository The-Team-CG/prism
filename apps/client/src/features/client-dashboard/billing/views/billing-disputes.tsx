"use client";

import { BILLING_DISCREPANCY_SEVERITIES, BILLING_DISCREPANCY_SEVERITY_LABELS, type PrismBillingStatement, type PrismStatementMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Textarea } from "@prism/ui/components/textarea";
import { formatPeso } from "@prism/ui/payment-track";
import { PrismSection } from "@prism/ui/page-blocks";
import { useState } from "react";
import { formatDayLabel, formatLabel } from "../../shared/tab-ui";
import type { useClientBillingDisputeViewModel } from "../view-models/use-client-billing-dispute-view-model";

type DisputeForm = ReturnType<typeof useClientBillingDisputeViewModel>;

/** Radix selects cannot hold an empty value, so "no related payment" is this sentinel in the list. */
const WHOLE_STATEMENT = "whole-statement";

function DisputeFields({ billing, milestones, disputeForm, onCancel, onSent }: { billing: PrismBillingStatement; milestones: PrismStatementMilestone[]; disputeForm: DisputeForm; onCancel: () => void; onSent: () => void }) {
  const canSubmit = !disputeForm.submitting && Boolean(disputeForm.amount) && Number(disputeForm.amount) <= billing.totalAmount && Boolean(disputeForm.reason.trim());
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="client-dispute-milestone">Which payment</FieldLabel>
        <Select value={disputeForm.milestoneId || WHOLE_STATEMENT} onValueChange={(value) => disputeForm.setMilestoneId(value === WHOLE_STATEMENT ? "" : value)}>
          <SelectTrigger id="client-dispute-milestone" className="w-full min-w-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={WHOLE_STATEMENT}>Whole statement</SelectItem>
            {milestones.map((milestone) => <SelectItem key={milestone.id} value={milestone.id}>{milestone.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="client-dispute-amount">Amount you question (₱)</FieldLabel>
        <Input id="client-dispute-amount" type="number" min="1" max={billing.totalAmount} value={disputeForm.amount} onChange={(event) => disputeForm.setAmount(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="client-dispute-severity">Kind of problem</FieldLabel>
        <Select
          value={disputeForm.severity}
          onValueChange={(value) => {
            const severity = BILLING_DISCREPANCY_SEVERITIES.find((candidate) => candidate === value);
            if (severity) disputeForm.setSeverity(severity);
          }}
        >
          <SelectTrigger id="client-dispute-severity" className="w-full min-w-0"><SelectValue /></SelectTrigger>
          <SelectContent>{BILLING_DISCREPANCY_SEVERITIES.map((severity) => <SelectItem key={severity} value={severity}>{BILLING_DISCREPANCY_SEVERITY_LABELS[severity]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="client-dispute-reason">What is wrong</FieldLabel>
        <Textarea id="client-dispute-reason" value={disputeForm.reason} onChange={(event) => disputeForm.setReason(event.target.value)} rows={3} maxLength={1000} />
      </Field>
      {disputeForm.error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{disputeForm.error}</p> : null}
      <DialogFooter className="sm:col-span-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!canSubmit} onClick={() => void disputeForm.submit().then((sent) => { if (sent) onSent(); })}>{disputeForm.submitting ? "Sending…" : "Send to PMCM"}</Button>
      </DialogFooter>
    </div>
  );
}

/**
 * Charges the client questioned, which payment each is about and where it stands. The heading carries the way to
 * raise a new one, which opens a dialog; with nothing raised yet, the heading and its line are all there is.
 */
export function BillingDisputes({ billing, milestones, disputeForm }: { billing: PrismBillingStatement; milestones: PrismStatementMilestone[]; disputeForm: DisputeForm }) {
  const [open, setOpen] = useState(false);
  const label = new Map(milestones.map((milestone) => [milestone.id, milestone.label]));
  const raised = disputeForm.disputes;
  return (
    <PrismSection
      id="client-billing-disputes"
      title="Question a charge"
      count={raised.length || undefined}
      description="PMCM reviews it and holds that amount while they do."
      headerOutside
      bare={raised.length === 0}
      flush
      action={<Button variant="outline" size="sm" onClick={() => setOpen(true)}>Raise a question</Button>}
    >
      {raised.length > 0 ? (
        <ul className="divide-y divide-border">
          {raised.map((dispute) => (
            <li key={dispute.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{formatPeso(dispute.amount)} questioned · {dispute.milestoneId ? label.get(dispute.milestoneId) ?? "A payment" : "Whole statement"}</span>
                <span className="block text-xs text-muted-foreground">{BILLING_DISCREPANCY_SEVERITY_LABELS[dispute.severity]} · raised {formatDayLabel(dispute.createdAt)}{dispute.resolvedAt ? ` · closed ${formatDayLabel(dispute.resolvedAt)}` : ""}</span>
              </span>
              <StatusBadge status={dispute.status} label={dispute.status === "open" ? "Under review" : formatLabel(dispute.status)} />
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Question a charge</DialogTitle>
            <DialogDescription>Tell PMCM which amount looks wrong and why. They hold that amount while they check.</DialogDescription>
          </DialogHeader>
          <DisputeFields billing={billing} milestones={milestones} disputeForm={disputeForm} onCancel={() => setOpen(false)} onSent={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </PrismSection>
  );
}
