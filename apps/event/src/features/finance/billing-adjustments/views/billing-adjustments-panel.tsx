"use client";

import type { PrismBillingSource, PrismBillingStatement, PrismPaymentMilestone } from "@prism/types";
import { money } from "@/features/pmcm-kit";
import { useBillingAdjustmentsPanel } from "../view-models/use-billing-adjustments-panel";

const fieldClass = "mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm";
const buttonClass = "h-9 rounded-md bg-(--prism-ink) px-4 text-xs font-black text-sidebar-foreground disabled:opacity-50";

type BillingAdjustmentsVm = ReturnType<typeof useBillingAdjustmentsPanel>;

export function BillingAdjustmentsPanel({
  eventId,
  statements,
  billingSources,
  payments,
}: {
  eventId: string;
  statements: PrismBillingStatement[];
  billingSources: PrismBillingSource[];
  payments: PrismPaymentMilestone[];
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
      {vm.error ? <p role="alert" className="text-xs font-semibold text-red-700">{vm.error}</p> : null}
      {vm.notice ? <p role="status" className="text-xs font-semibold text-(--prism-success)">{vm.notice}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <DisputeSection vm={vm} />
        <CorrectionSection vm={vm} />
        <AdditionalBillingSection vm={vm} />
      </div>
    </section>
  );
}

function DisputeSection({ vm }: { vm: BillingAdjustmentsVm }) {
  const openDisputes = vm.disputes.filter((dispute) => dispute.status === "open");

  return (
    <>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void vm.submitDispute(); }}>
        <h3 className="text-xs font-bold text-foreground">Record a dispute</h3>
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

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-foreground">Open disputes</h3>
        {openDisputes.length === 0 ? <p className="text-xs text-muted-foreground">No open disputes.</p> : null}
        {openDisputes.map((dispute) => (
          <div key={dispute.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold">{money.format(dispute.amount)} disputed: {dispute.reason}</p>
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
      </div>
    </>
  );
}

function CorrectionSection({ vm }: { vm: BillingAdjustmentsVm }) {
  return (
    <>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void vm.submitCorrection(); }}>
        <h3 className="text-xs font-bold text-foreground">Request a statement correction</h3>
        <p className="text-xs text-muted-foreground">The original statement is kept; the correction is recorded alongside it.</p>
        <label className="block text-xs font-semibold">Reason
          <textarea className={fieldClass} rows={2} value={vm.correctionDraft.reason} onChange={(e) => vm.setCorrectionDraft({ ...vm.correctionDraft, reason: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold">Corrected total (optional)
          <input className={fieldClass} inputMode="numeric" value={vm.correctionDraft.correctedTotalAmount} onChange={(e) => vm.setCorrectionDraft({ ...vm.correctionDraft, correctedTotalAmount: e.target.value })} />
        </label>
        <button type="submit" className={buttonClass} disabled={vm.busy || !vm.statement || !vm.correctionDraft.reason.trim()}>Request correction</button>
      </form>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-foreground">Correction requests</h3>
        {vm.corrections.length === 0 ? <p className="text-xs text-muted-foreground">No correction requests.</p> : null}
        {vm.corrections.map((correction) => (
          <div key={correction.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold">{correction.reason} ({correction.status})</p>
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
      </div>
    </>
  );
}

function AdditionalBillingSection({ vm }: { vm: BillingAdjustmentsVm }) {
  return (
    <>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void vm.submitAdditionalBilling(); }}>
        <h3 className="text-xs font-bold text-foreground">Additional billing</h3>
        <p className="text-xs text-muted-foreground">Only approved billing sources can carry additional billing for this event.</p>
        <label className="block text-xs font-semibold">Approved source
          <select className={fieldClass} value={vm.additionalDraft.billingSourceId} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, billingSourceId: e.target.value })}>
            <option value="">Select an approved source</option>
            {vm.approvedSources.map((source) => <option key={source.id} value={source.id}>{source.sourceLabel}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">Urgent issue ID
          <input className={fieldClass} value={vm.additionalDraft.urgentIssueId} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, urgentIssueId: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold">Description
          <input className={fieldClass} value={vm.additionalDraft.description} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, description: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold">Amount
          <input className={fieldClass} inputMode="numeric" value={vm.additionalDraft.amount} onChange={(e) => vm.setAdditionalDraft({ ...vm.additionalDraft, amount: e.target.value })} />
        </label>
        <button type="submit" className={buttonClass} disabled={vm.busy || !vm.additionalDraft.billingSourceId || !vm.additionalDraft.description.trim()}>Issue additional billing</button>
      </form>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-foreground">Issued additional billing</h3>
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
      </div>
    </>
  );
}
