"use client";

import { useState, type ReactNode } from "react";
import type { PrismBillingSource, PrismBillingStatement, PrismPaymentMilestone, PrismUrgentIssue } from "@prism/types";
import { money } from "@/features/pmcm-kit";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { BILLING_DISCREPANCY_SEVERITIES, BILLING_DISCREPANCY_SEVERITY_LABELS, type BillingDiscrepancySeverity } from "@prism/types";
import { useBillingAdjustmentsPanel } from "../view-models/use-billing-adjustments-panel";

const fieldClass = "mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm";
const actionButtonClass = "bg-ink font-semibold text-ink-foreground hover:bg-ink/90";
const toggleClass = "h-9 rounded-md border border-border bg-background px-4 text-xs font-semibold text-foreground";

type BillingAdjustmentsVm = ReturnType<typeof useBillingAdjustmentsPanel>;

/** Lists come first; each creation flow opens from its own button so the page is not three forms over empty lists. */
export function BillingAdjustmentsPanel({
  eventId,
  statements,
  billingSources,
  payments,
  urgentIssues,
}: {
  eventId: string;
  statements: PrismBillingStatement[];
  billingSources: PrismBillingSource[];
  payments: PrismPaymentMilestone[];
  urgentIssues: PrismUrgentIssue[];
}) {
  const vm = useBillingAdjustmentsPanel({ eventId, statements, billingSources, payments });

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Billing adjustments</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Disputes, corrections, and additional billing are recorded by PMCM. Clients see dispute status only.
        </p>
      </div>
      {vm.error ? <p role="alert" className="text-xs font-semibold text-danger">{vm.error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <DisputeSection vm={vm} />
        <CorrectionSection vm={vm} />
        <AdditionalBillingSection vm={vm} urgentIssues={urgentIssues} />
      </div>
    </section>
  );
}

function CreateToggle({ label, open, controls, onToggle }: { label: string; open: boolean; controls: string; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onToggle} className={toggleClass}>
      {open ? "Close form" : label}
    </button>
  );
}

/** Radix Select cannot hold an empty-string item, so "none" stands for an unset optional choice. */
const NO_CHOICE = "none";

function SeveritySelect({ value, onChange }: { value: BillingDiscrepancySeverity; onChange: (value: BillingDiscrepancySeverity) => void }) {
  return (
    <div className="block text-xs font-semibold">
      <span>Discrepancy severity</span>
      <Select value={value} onValueChange={(next) => onChange(next as BillingDiscrepancySeverity)}>
        <SelectTrigger aria-label="Discrepancy severity" className="mt-1 h-9 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BILLING_DISCREPANCY_SEVERITIES.map((severity) => <SelectItem key={severity} value={severity}>{BILLING_DISCREPANCY_SEVERITY_LABELS[severity]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      {action}
    </div>
  );
}

function DisputeSection({ vm }: { vm: BillingAdjustmentsVm }) {
  const [creating, setCreating] = useState(false);
  const openDisputes = vm.disputes.filter((dispute) => dispute.status === "open");

  return (
    <div className="space-y-3">
      <SectionHeader title="Open disputes" action={<CreateToggle label="Record dispute" open={creating} controls="billing-dispute-form" onToggle={() => setCreating((open) => !open)} />} />
      {openDisputes.length === 0 ? <p className="text-xs text-muted-foreground">No open disputes.</p> : null}
      {openDisputes.map((dispute) => (
        <div key={dispute.id} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold">{money.format(dispute.amount)} disputed: {dispute.reason}</p>
          <p className="text-xs text-muted-foreground">Severity: {BILLING_DISCREPANCY_SEVERITY_LABELS[dispute.severity]}</p>
          <input
            className={fieldClass}
            placeholder="Resolution notes (required to reject)"
            value={vm.resolutionNotes[dispute.id] ?? ""}
            onChange={(e) => vm.setResolutionNotes({ ...vm.resolutionNotes, [dispute.id]: e.target.value })}
          />
          <div className="flex gap-2">
            <Button size="sm" type="button" className={actionButtonClass} disabled={vm.busy || !(vm.resolutionNotes[dispute.id] ?? "").trim()} onClick={() => void vm.resolveDispute(dispute.id, "resolve")}>Resolve</Button>
            <Button size="sm" type="button" className={actionButtonClass} disabled={vm.busy || !(vm.resolutionNotes[dispute.id] ?? "").trim()} onClick={() => void vm.resolveDispute(dispute.id, "reject")}>Reject</Button>
          </div>
        </div>
      ))}
      {creating ? (
        <form id="billing-dispute-form" className="space-y-3 rounded-lg border border-border p-3" onSubmit={(event) => { event.preventDefault(); void vm.submitDispute(); }}>
          <SeveritySelect value={vm.disputeDraft.severity} onChange={(severity) => vm.setDisputeDraft({ ...vm.disputeDraft, severity })} />
          <div className="block text-xs font-semibold">
            <span>Milestone (optional)</span>
            <Select value={vm.disputeDraft.milestoneId || NO_CHOICE} onValueChange={(next) => vm.setDisputeDraft({ ...vm.disputeDraft, milestoneId: next === NO_CHOICE ? "" : next })}>
              <SelectTrigger aria-label="Milestone" className="mt-1 h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHOICE}>Whole statement</SelectItem>
                {vm.payments.map((payment) => <SelectItem key={payment.id} value={payment.id}>{payment.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="block text-xs font-semibold">Disputed amount
            <input className={fieldClass} inputMode="numeric" value={vm.disputeDraft.amount} onChange={(e) => vm.setDisputeDraft({ ...vm.disputeDraft, amount: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold">Reason
            <textarea className={fieldClass} rows={2} value={vm.disputeDraft.reason} onChange={(e) => vm.setDisputeDraft({ ...vm.disputeDraft, reason: e.target.value })} />
          </label>
          <Button size="sm" type="submit" className={actionButtonClass} disabled={vm.busy || !vm.statement || !vm.disputeDraft.reason.trim()}>Record dispute</Button>
        </form>
      ) : null}
    </div>
  );
}

function CorrectionSection({ vm }: { vm: BillingAdjustmentsVm }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <SectionHeader title="Correction requests" action={<CreateToggle label="Request correction" open={creating} controls="billing-correction-form" onToggle={() => setCreating((open) => !open)} />} />
      {vm.corrections.length === 0 ? <p className="text-xs text-muted-foreground">No correction requests.</p> : null}
      {vm.corrections.map((correction) => (
        <div key={correction.id} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold">{correction.reason} ({correction.status})</p>
          <p className="text-xs text-muted-foreground">Severity: {BILLING_DISCREPANCY_SEVERITY_LABELS[correction.severity]}</p>
          {correction.status === "pending" ? (
            <>
              <input
                className={fieldClass}
                placeholder="Rejection reason (required to reject)"
                value={vm.correctionNotes[correction.id] ?? ""}
                onChange={(e) => vm.setCorrectionNotes({ ...vm.correctionNotes, [correction.id]: e.target.value })}
              />
              {vm.isOwnCorrectionRequest(correction) ? (
                <p className="text-xs text-muted-foreground">You requested this correction. Another PMCM user must approve it; you can still reject it.</p>
              ) : null}
              <div className="flex gap-2">
                <Button size="sm" type="button" className={actionButtonClass} disabled={vm.busy || !vm.canApproveCorrection(correction)} onClick={() => void vm.resolveCorrection(correction.id, "approve")}>Approve</Button>
                <Button size="sm" type="button" className={actionButtonClass} disabled={vm.busy || !(vm.correctionNotes[correction.id] ?? "").trim()} onClick={() => void vm.resolveCorrection(correction.id, "reject")}>Reject</Button>
              </div>
            </>
          ) : null}
        </div>
      ))}
      {creating ? (
        <form id="billing-correction-form" className="space-y-3 rounded-lg border border-border p-3" onSubmit={(event) => { event.preventDefault(); void vm.submitCorrection(); }}>
          <p className="text-xs text-muted-foreground">The original statement is kept; the correction is recorded alongside it.</p>
          <label className="block text-xs font-semibold">Reason
            <textarea className={fieldClass} rows={2} value={vm.correctionDraft.reason} onChange={(e) => vm.setCorrectionDraft({ ...vm.correctionDraft, reason: e.target.value })} />
          </label>
          <SeveritySelect value={vm.correctionDraft.severity} onChange={(severity) => vm.setCorrectionDraft({ ...vm.correctionDraft, severity })} />
          <label className="block text-xs font-semibold">Corrected total (optional)
            <input className={fieldClass} inputMode="numeric" disabled={vm.correctionDraft.severity === "typo_correction"} value={vm.correctionDraft.correctedTotalAmount} onChange={(e) => vm.setCorrectionDraft({ ...vm.correctionDraft, correctedTotalAmount: e.target.value })} />
            {vm.correctionDraft.severity === "typo_correction" ? <span className="mt-1 block font-normal text-muted-foreground">A typo correction cannot change the amount.</span> : null}
          </label>
          <Button size="sm" type="submit" className={actionButtonClass} disabled={vm.busy || !vm.statement || !vm.correctionDraft.reason.trim()}>Request correction</Button>
        </form>
      ) : null}
    </div>
  );
}

function AdditionalBillingSection({ vm, urgentIssues }: { vm: BillingAdjustmentsVm; urgentIssues: PrismUrgentIssue[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <SectionHeader title="Issued additional billing" action={<CreateToggle label="Issue additional billing" open={creating} controls="billing-additional-form" onToggle={() => setCreating((open) => !open)} />} />
      {vm.additionalBillings.length === 0 ? <p className="text-xs text-muted-foreground">No additional billing issued.</p> : null}
      {vm.additionalBillings.map((billing) => (
        <div key={billing.id} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold">{billing.description}: {money.format(billing.amount)} ({billing.status})</p>
          {billing.status === "issued" ? (
            <div className="flex gap-2">
              <input
                className={fieldClass}
                placeholder="Waiver reason (required)"
                value={vm.waiverReasons[billing.id] ?? ""}
                onChange={(e) => vm.setWaiverReasons({ ...vm.waiverReasons, [billing.id]: e.target.value })}
              />
              <Button size="sm" type="button" className={actionButtonClass} disabled={vm.busy || !(vm.waiverReasons[billing.id] ?? "").trim()} onClick={() => void vm.waiveAdditionalBilling(billing.id)}>Waive</Button>
            </div>
          ) : null}
        </div>
      ))}
      {creating ? (
        <form id="billing-additional-form" className="space-y-3 rounded-lg border border-border p-3" onSubmit={(event) => { event.preventDefault(); void vm.submitAdditionalBilling(); }}>
          <p className="text-xs text-muted-foreground">Only approved billing sources can carry additional billing for this event.</p>
          <div className="block text-xs font-semibold">
            <span>Approved source</span>
            <Select value={vm.additionalDraft.billingSourceId || NO_CHOICE} onValueChange={(next) => vm.setAdditionalDraft({ ...vm.additionalDraft, billingSourceId: next === NO_CHOICE ? "" : next })}>
              <SelectTrigger aria-label="Approved source" className="mt-1 h-9 w-full text-sm">
                <SelectValue placeholder="Select an approved source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHOICE}>Select an approved source</SelectItem>
                {vm.approvedSources.map((source) => <SelectItem key={source.id} value={source.id}>{source.sourceLabel}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="block text-xs font-semibold">
            <span>Linked urgent issue (optional)</span>
            <Select value={vm.additionalDraft.urgentIssueId || NO_CHOICE} onValueChange={(next) => vm.setAdditionalDraft({ ...vm.additionalDraft, urgentIssueId: next === NO_CHOICE ? "" : next })}>
              <SelectTrigger aria-label="Linked urgent issue" className="mt-1 h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHOICE}>No linked issue</SelectItem>
                {urgentIssues.map((issue) => <SelectItem key={issue.id} value={issue.id}>{issue.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="block text-xs font-semibold">Description
            <input className={fieldClass} value={vm.additionalDraft.description} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, description: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold">Amount
            <input className={fieldClass} inputMode="numeric" value={vm.additionalDraft.amount} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, amount: e.target.value })} />
          </label>
          <Button size="sm" type="submit" className={actionButtonClass} disabled={vm.busy || !vm.additionalDraft.billingSourceId || !vm.additionalDraft.description.trim()}>Issue additional billing</Button>
        </form>
      ) : null}
    </div>
  );
}
