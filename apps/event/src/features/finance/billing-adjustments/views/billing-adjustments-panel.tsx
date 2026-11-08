"use client";

import { useState, type ReactNode } from "react";
import type { PrismBillingSource, PrismBillingStatement, PrismPaymentMilestone, PrismUrgentIssue } from "@prism/types";
import { money } from "@/features/pmcm-kit";
import { BILLING_DISCREPANCY_SEVERITIES, BILLING_DISCREPANCY_SEVERITY_LABELS, type BillingDiscrepancySeverity } from "@prism/types";
import { useBillingAdjustmentsPanel } from "../view-models/use-billing-adjustments-panel";

const fieldClass = "mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm";
const buttonClass = "h-9 rounded-md bg-ink px-4 text-xs font-black text-ink-foreground disabled:opacity-50";
const toggleClass = "h-9 rounded-md border border-border bg-background px-4 text-xs font-bold text-foreground";

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
    <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-foreground">Billing adjustments</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Disputes, corrections, and additional billing are recorded by PMCM. Clients see dispute status only.
        </p>
      </div>
      {vm.error ? <p role="alert" className="text-xs font-semibold text-danger">{vm.error}</p> : null}
      {vm.notice ? <p role="status" className="text-xs font-semibold text-success">{vm.notice}</p> : null}

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

function SeveritySelect({ value, onChange }: { value: BillingDiscrepancySeverity; onChange: (value: BillingDiscrepancySeverity) => void }) {
  return (
    <label className="block text-xs font-semibold">Discrepancy severity
      <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value as BillingDiscrepancySeverity)}>
        {BILLING_DISCREPANCY_SEVERITIES.map((severity) => <option key={severity} value={severity}>{BILLING_DISCREPANCY_SEVERITY_LABELS[severity]}</option>)}
      </select>
    </label>
  );
}

function SectionHeader({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-bold text-foreground">{title}</h3>
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
        <div key={dispute.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold">{money.format(dispute.amount)} disputed: {dispute.reason}</p>
          <p className="text-xs text-muted-foreground">Severity: {BILLING_DISCREPANCY_SEVERITY_LABELS[dispute.severity]}</p>
          <input
            className={fieldClass}
            placeholder="Resolution notes (required to reject)"
            value={vm.resolutionNotes[dispute.id] ?? ""}
            onChange={(e) => vm.setResolutionNotes({ ...vm.resolutionNotes, [dispute.id]: e.target.value })}
          />
          <div className="flex gap-2">
            <button type="button" className={buttonClass} disabled={vm.busy || !(vm.resolutionNotes[dispute.id] ?? "").trim()} onClick={() => void vm.resolveDispute(dispute.id, "resolve")}>Resolve</button>
            <button type="button" className={buttonClass} disabled={vm.busy || !(vm.resolutionNotes[dispute.id] ?? "").trim()} onClick={() => void vm.resolveDispute(dispute.id, "reject")}>Reject</button>
          </div>
        </div>
      ))}
      {creating ? (
        <form id="billing-dispute-form" className="space-y-3 rounded-xl border border-border p-3" onSubmit={(event) => { event.preventDefault(); void vm.submitDispute(); }}>
          <SeveritySelect value={vm.disputeDraft.severity} onChange={(severity) => vm.setDisputeDraft({ ...vm.disputeDraft, severity })} />
          <label className="block text-xs font-semibold">Milestone (optional)
            <select className={fieldClass} value={vm.disputeDraft.milestoneId} onChange={(e) => vm.setDisputeDraft({ ...vm.disputeDraft, milestoneId: e.target.value })}>
              <option value="">Whole statement</option>
              {vm.payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">Disputed amount
            <input className={fieldClass} inputMode="numeric" value={vm.disputeDraft.amount} onChange={(e) => vm.setDisputeDraft({ ...vm.disputeDraft, amount: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold">Reason
            <textarea className={fieldClass} rows={2} value={vm.disputeDraft.reason} onChange={(e) => vm.setDisputeDraft({ ...vm.disputeDraft, reason: e.target.value })} />
          </label>
          <button type="submit" className={buttonClass} disabled={vm.busy || !vm.statement || !vm.disputeDraft.reason.trim()}>Record dispute</button>
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
        <div key={correction.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
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
                <button type="button" className={buttonClass} disabled={vm.busy || !vm.canApproveCorrection(correction)} onClick={() => void vm.resolveCorrection(correction.id, "approve")}>Approve</button>
                <button type="button" className={buttonClass} disabled={vm.busy || !(vm.correctionNotes[correction.id] ?? "").trim()} onClick={() => void vm.resolveCorrection(correction.id, "reject")}>Reject</button>
              </div>
            </>
          ) : null}
        </div>
      ))}
      {creating ? (
        <form id="billing-correction-form" className="space-y-3 rounded-xl border border-border p-3" onSubmit={(event) => { event.preventDefault(); void vm.submitCorrection(); }}>
          <p className="text-xs text-muted-foreground">The original statement is kept; the correction is recorded alongside it.</p>
          <label className="block text-xs font-semibold">Reason
            <textarea className={fieldClass} rows={2} value={vm.correctionDraft.reason} onChange={(e) => vm.setCorrectionDraft({ ...vm.correctionDraft, reason: e.target.value })} />
          </label>
          <SeveritySelect value={vm.correctionDraft.severity} onChange={(severity) => vm.setCorrectionDraft({ ...vm.correctionDraft, severity })} />
          <label className="block text-xs font-semibold">Corrected total (optional)
            <input className={fieldClass} inputMode="numeric" disabled={vm.correctionDraft.severity === "typo_correction"} value={vm.correctionDraft.correctedTotalAmount} onChange={(e) => vm.setCorrectionDraft({ ...vm.correctionDraft, correctedTotalAmount: e.target.value })} />
            {vm.correctionDraft.severity === "typo_correction" ? <span className="mt-1 block font-normal text-muted-foreground">A typo correction cannot change the amount.</span> : null}
          </label>
          <button type="submit" className={buttonClass} disabled={vm.busy || !vm.statement || !vm.correctionDraft.reason.trim()}>Request correction</button>
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
        <div key={billing.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold">{billing.description}: {money.format(billing.amount)} ({billing.status})</p>
          {billing.status === "issued" ? (
            <div className="flex gap-2">
              <input
                className={fieldClass}
                placeholder="Waiver reason (required)"
                value={vm.waiverReasons[billing.id] ?? ""}
                onChange={(e) => vm.setWaiverReasons({ ...vm.waiverReasons, [billing.id]: e.target.value })}
              />
              <button type="button" className={buttonClass} disabled={vm.busy || !(vm.waiverReasons[billing.id] ?? "").trim()} onClick={() => void vm.waiveAdditionalBilling(billing.id)}>Waive</button>
            </div>
          ) : null}
        </div>
      ))}
      {creating ? (
        <form id="billing-additional-form" className="space-y-3 rounded-xl border border-border p-3" onSubmit={(event) => { event.preventDefault(); void vm.submitAdditionalBilling(); }}>
          <p className="text-xs text-muted-foreground">Only approved billing sources can carry additional billing for this event.</p>
          <label className="block text-xs font-semibold">Approved source
            <select className={fieldClass} value={vm.additionalDraft.billingSourceId} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, billingSourceId: e.target.value })}>
              <option value="">Select an approved source</option>
              {vm.approvedSources.map((source) => <option key={source.id} value={source.id}>{source.sourceLabel}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">Linked urgent issue (optional)
            <select aria-label="Linked urgent issue" className={fieldClass} value={vm.additionalDraft.urgentIssueId} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, urgentIssueId: e.target.value })}>
              <option value="">No linked issue</option>
              {urgentIssues.map((issue) => <option key={issue.id} value={issue.id}>{issue.title}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">Description
            <input className={fieldClass} value={vm.additionalDraft.description} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, description: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold">Amount
            <input className={fieldClass} inputMode="numeric" value={vm.additionalDraft.amount} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, amount: e.target.value })} />
          </label>
          <button type="submit" className={buttonClass} disabled={vm.busy || !vm.additionalDraft.billingSourceId || !vm.additionalDraft.description.trim()}>Issue additional billing</button>
        </form>
      ) : null}
    </div>
  );
}
