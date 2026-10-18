"use client";

import { useState, type FormEvent } from "react";
import type { RecordEventDecisionInput, PrismEventFreezeException } from "@prism/types";
import { depositTreatmentOptions, decisionOptions, supplierImpactOptions } from "../model/change-register-rules";

type DecisionValue = RecordEventDecisionInput["decision"];

/**
 * Records a cancellation or postponement. The impact review is part of the submission: the coordinator,
 * supplier, and billing treatments must be chosen and the review confirmed before the decision can be sent.
 */
export function RecordDecisionForm({
  frozen,
  approvedExceptions,
  busy,
  onSubmit,
}: {
  frozen: boolean;
  approvedExceptions: readonly PrismEventFreezeException[];
  busy: boolean;
  onSubmit: (draft: RecordEventDecisionInput) => Promise<boolean>;
}) {
  const [decision, setDecision] = useState<DecisionValue>("cancelled");
  const [reason, setReason] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [cancellationFeeAmount, setCancellationFeeAmount] = useState(0);
  const [depositTreatment, setDepositTreatment] = useState<"retain" | "credit" | "waive">("retain");
  const [supplierImpact, setSupplierImpact] = useState<"release_obligations" | "preserve_obligations">("release_obligations");
  const [freezeExceptionId, setFreezeExceptionId] = useState("");
  const [impactReviewed, setImpactReviewed] = useState(false);
  // One key per drafted decision so a retried submit replays instead of recording twice.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const needsDate = decision === "postponed";
  const needsException = frozen;
  const canSubmit = !busy
    && reason.trim().length > 0
    && (!needsDate || newEventDate.length > 0)
    && (!needsException || freezeExceptionId.length > 0)
    && impactReviewed;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({
      decision,
      reason,
      newEventDate: needsDate ? newEventDate : undefined,
      cancellationFeeAmount,
      depositTreatment,
      supplierImpact,
      freezeExceptionId: needsException ? freezeExceptionId : undefined,
      impactReviewAcknowledged: true,
      idempotencyKey,
    });
    if (saved) {
      setReason("");
      setNewEventDate("");
      setCancellationFeeAmount(0);
      setFreezeExceptionId("");
      setImpactReviewed(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-border pt-4" aria-label="Record cancellation or postponement">
      <h3 className="text-sm font-semibold text-foreground">Record a cancellation or postponement</h3>

      <label className="block text-sm">
        <span className="text-muted-foreground">Decision</span>
        <select value={decision} onChange={(event) => setDecision(event.target.value as DecisionValue)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
          {decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-muted-foreground">Reason</span>
        <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>

      {needsDate ? (
        <label className="block text-sm">
          <span className="text-muted-foreground">New event date</span>
          <input type="date" required value={newEventDate} onChange={(event) => setNewEventDate(event.target.value)} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </label>
      ) : null}

      {needsException ? (
        <label className="block text-sm">
          <span className="text-muted-foreground">Approved freeze exception (used once)</span>
          <select required value={freezeExceptionId} onChange={(event) => setFreezeExceptionId(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Choose an approved exception</option>
            {approvedExceptions.map((exception) => <option key={exception.id} value={exception.id}>{exception.requestedChange}</option>)}
          </select>
          {approvedExceptions.length === 0 ? <span className="mt-1 block text-xs text-muted-foreground">No unused approved exception. Request and approve one first.</span> : null}
        </label>
      ) : null}

      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Impact review</legend>
        <p className="text-xs text-muted-foreground">Coordinator assignments on this event are released or kept when the decision is recorded. Check the coordinator desk first.</p>
        <label className="block text-sm">
          <span className="text-muted-foreground">Supplier obligations</span>
          <select value={supplierImpact} onChange={(event) => setSupplierImpact(event.target.value as typeof supplierImpact)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {supplierImpactOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Cancellation fee (minor units)</span>
          <input type="number" min={0} step={1} value={cancellationFeeAmount} onChange={(event) => setCancellationFeeAmount(Number(event.target.value) || 0)} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Deposit treatment</span>
          <select value={depositTreatment} onChange={(event) => setDepositTreatment(event.target.value as typeof depositTreatment)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {depositTreatmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={impactReviewed} onChange={(event) => setImpactReviewed(event.target.checked)} className="mt-1" />
          <span>I have reviewed the coordinator, supplier, and billing impact for this decision.</span>
        </label>
      </fieldset>

      <button type="submit" disabled={!canSubmit} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Record decision</button>
    </form>
  );
}
