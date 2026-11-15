"use client";

import { Scale } from "lucide-react";
import { BILLING_DISCREPANCY_SEVERITIES, BILLING_DISCREPANCY_SEVERITY_LABELS, type PrismBillingStatement, type PrismStatementMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Textarea } from "@prism/ui/components/textarea";
import { formatPeso } from "@prism/ui/payment-track";
import { formatDayLabel, formatLabel } from "../../shared/tab-ui";
import type { useClientBillingDisputeViewModel } from "../view-models/use-client-billing-dispute-view-model";

type DisputeForm = ReturnType<typeof useClientBillingDisputeViewModel>;

/** Radix selects cannot hold an empty value, so "no related payment" is this sentinel in the list. */
const WHOLE_STATEMENT = "whole-statement";

function DisputeFields({ billing, milestones, disputeForm }: { billing: PrismBillingStatement; milestones: PrismStatementMilestone[]; disputeForm: DisputeForm }) {
  const canSubmit = !disputeForm.submitting && Boolean(disputeForm.amount) && Number(disputeForm.amount) <= billing.totalAmount && Boolean(disputeForm.reason.trim());
  return (
    <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2">
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
      <div className="sm:col-span-2">
        <Button disabled={!canSubmit} onClick={() => void disputeForm.submit()}>{disputeForm.submitting ? "Sending…" : "Send to PMCM"}</Button>
      </div>
    </div>
  );
}

/** Charges the client questioned, which payment each is about and where it stands; the form stays folded until needed. */
export function BillingDisputes({ billing, milestones, disputeForm }: { billing: PrismBillingStatement; milestones: PrismStatementMilestone[]; disputeForm: DisputeForm }) {
  const label = new Map(milestones.map((milestone) => [milestone.id, milestone.label]));
  return (
    <Card role="region" aria-labelledby="client-billing-disputes" className="gap-0 overflow-hidden py-0">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="flex items-center gap-3">
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"><Scale className="size-4" /></span>
            <span>
              <span id="client-billing-disputes" className="block text-sm font-semibold text-foreground">Question a charge</span>
              <span className="block text-xs text-muted-foreground">PMCM reviews it and holds that amount while they do.</span>
            </span>
          </span>
          <span className="text-sm font-medium text-primary">Raise a question</span>
        </summary>
        <DisputeFields billing={billing} milestones={milestones} disputeForm={disputeForm} />
      </details>
      {disputeForm.disputes.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {disputeForm.disputes.map((dispute) => (
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
    </Card>
  );
}
