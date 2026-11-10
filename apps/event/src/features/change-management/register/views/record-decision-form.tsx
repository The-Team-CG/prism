"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { useState, type FormEvent } from "react";
import type { PrismCancellationSummary, RecordEventDecisionInput, PrismEventFreezeException } from "@prism/types";
import { useCancellationSummary } from "../view-models/use-cancellation-summary";
import { DatePicker } from "@prism/ui/components/date-picker";
import { canRecordDecision, depositTreatmentOptions, decisionOptions, supplierImpactOptions, type RecordDecisionDraft } from "../model/change-register-rules";

type DecisionValue = RecordEventDecisionInput["decision"];

/**
 * Records a cancellation or postponement. The impact review is part of the submission: the coordinator,
 * supplier, and billing treatments must be chosen and the review confirmed before the decision can be sent.
 */
function CancellationSummaryNote({ summary, error, onUseSuggested }: {
  summary: PrismCancellationSummary | null;
  error: string | null;
  onUseSuggested: (fee: number) => void;
}) {
  if (error) return <span role="alert" className="mt-1 block text-xs text-destructive">{error}</span>;
  if (!summary) return <span className="mt-1 block text-xs text-muted-foreground">Loading the cancellation summary…</span>;
  const peso = (amount: number) => `PHP ${amount.toLocaleString("en-PH")}`;
  return (
    <span className="mt-2 block rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
      Contract {peso(summary.contractAmount)} · received {peso(summary.paidAmount)} · supplier commitments {peso(summary.committedSupplierAmount)}.{" "}
      {summary.conformeSigned
        ? <>Fee {peso(summary.feeMinimum)} to {peso(summary.feeMaximum)} (10 to 15 percent of the contract). <button type="button" className="font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => onUseSuggested(summary.suggestedFee)}>Use {peso(summary.suggestedFee)}</button></>
        : "No fee applies: the conforme is not signed."}
    </span>
  );
}

export function RecordDecisionForm({
  eventId,
  frozen,
  approvedExceptions,
  busy,
  onSubmit,
}: {
  eventId: string;
  frozen: boolean;
  approvedExceptions: readonly PrismEventFreezeException[];
  busy: boolean;
  onSubmit: (draft: RecordDecisionDraft) => Promise<boolean>;
}) {
  // No decision is preselected: a cancellation must be an explicit choice, never the default.
  const [decision, setDecision] = useState<DecisionValue | "">("");
  const [reason, setReason] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [cancellationFeePesos, setCancellationFeePesos] = useState("");
  const [depositTreatment, setDepositTreatment] = useState<"retain" | "credit" | "waive">("retain");
  const [supplierImpact, setSupplierImpact] = useState<"release_obligations" | "preserve_obligations">("release_obligations");
  const [freezeExceptionId, setFreezeExceptionId] = useState("");
  const [impactReviewed, setImpactReviewed] = useState(false);
  // One key per drafted decision so a retried submit replays instead of recording twice.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const needsDate = decision === "postponed";
  const cancelling = decision === "cancelled";
  const cancellation = useCancellationSummary(eventId, cancelling);
  const needsException = frozen;
  const canSubmit = !busy && canRecordDecision({ decision, reason, newEventDate, frozen, freezeExceptionId, impactReviewed });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (decision === "") return;
    const saved = await onSubmit({
      decision,
      reason,
      newEventDate: needsDate ? newEventDate : undefined,
      cancellationFeePesos,
      depositTreatment,
      supplierImpact,
      freezeExceptionId: needsException ? freezeExceptionId : undefined,
      impactReviewAcknowledged: true,
      idempotencyKey,
    });
    if (saved) {
      setReason("");
      setNewEventDate("");
      setCancellationFeePesos("");
      setFreezeExceptionId("");
      setImpactReviewed(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  }

  return (
    <details className="rounded-lg border border-danger/40 bg-danger-soft/30 p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold text-danger">Cancel or postpone this event</summary>
      <form onSubmit={submit} className="mt-4 space-y-4" aria-label="Record cancellation or postponement">
        <p className="text-xs text-muted-foreground">Recording a cancellation or postponement releases or keeps coordinator and supplier obligations. Choose the decision explicitly.</p>

        <div className="block text-sm">
          <span className="text-muted-foreground">Decision</span>
          <Select required value={decision} onValueChange={(value) => setDecision(decisionOptions.find((option) => option.value === value)?.value ?? "")}>
            <SelectTrigger aria-label="Decision" className="mt-1 w-full min-w-0">
              <SelectValue placeholder="Choose a decision…" />
            </SelectTrigger>
            <SelectContent>
              {decisionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <label className="block text-sm">
          <span className="text-muted-foreground">Reason</span>
          <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </label>

        {needsDate ? (
          <div className="block text-sm">
            <span className="text-muted-foreground">New event date</span>
            <DatePicker aria-label="New event date" required value={newEventDate} onValueChange={setNewEventDate} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
        ) : null}

        {needsException ? (
          <div className="block text-sm">
            <span className="text-muted-foreground">Approved freeze exception (used once)</span>
            <Select required value={freezeExceptionId} onValueChange={setFreezeExceptionId}>
              <SelectTrigger aria-label="Approved freeze exception" className="mt-1 w-full min-w-0">
                <SelectValue placeholder="Choose an approved exception" />
              </SelectTrigger>
              <SelectContent>
                {approvedExceptions.map((exception) => <SelectItem key={exception.id} value={exception.id}>{exception.requestedChange}</SelectItem>)}
              </SelectContent>
            </Select>
            {approvedExceptions.length === 0 ? <span className="mt-1 block text-xs text-muted-foreground">No unused approved exception. Request and approve one first.</span> : null}
          </div>
        ) : null}

        <fieldset className="space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-semibold text-foreground">Impact review</legend>
          <p className="text-xs text-muted-foreground">Coordinator assignments on this event are released or kept when the decision is recorded. Check the coordinator desk first.</p>
          <div className="block text-sm">
            <span className="text-muted-foreground">Supplier obligations</span>
            <Select value={supplierImpact} onValueChange={(value) => setSupplierImpact(supplierImpactOptions.find((option) => option.value === value)?.value ?? supplierImpact)}>
              <SelectTrigger aria-label="Supplier obligations" className="mt-1 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplierImpactOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {cancelling ? (
            <label className="block text-sm">
              <span className="text-muted-foreground">Cancellation fee (PHP)</span>
              <input inputMode="numeric" value={cancellationFeePesos} onChange={(event) => setCancellationFeePesos(event.target.value)} placeholder="0" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <CancellationSummaryNote summary={cancellation.summary} error={cancellation.error} onUseSuggested={(fee) => setCancellationFeePesos(String(fee))} />
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">Postponements never carry a cancellation fee; the downpayment carries over to the new date.</p>
          )}
          <div className="block text-sm">
            <span className="text-muted-foreground">Deposit treatment</span>
            <Select value={depositTreatment} onValueChange={(value) => setDepositTreatment(depositTreatmentOptions.find((option) => option.value === value)?.value ?? depositTreatment)}>
              <SelectTrigger aria-label="Deposit treatment" className="mt-1 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {depositTreatmentOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={impactReviewed} onChange={(event) => setImpactReviewed(event.target.checked)} className="mt-1" />
            <span>I have reviewed the coordinator, supplier, and billing impact for this decision.</span>
          </label>
        </fieldset>

        <button type="submit" disabled={!canSubmit} className="rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Record decision</button>
      </form>
    </details>
  );
}
