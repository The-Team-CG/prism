"use client";

import { useState } from "react";
import type { PrismBillingStatement, PrismClientBillingDispute } from "@prism/types";
import { submitClientBillingDispute } from "../use-cases/submit-client-billing-dispute";

export function useClientBillingDisputeViewModel(input: {
  eventId?: string;
  billing?: PrismBillingStatement;
  disputes: PrismClientBillingDispute[];
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<PrismClientBillingDispute[]>([]);

  async function submit() {
    if (!input.eventId || !input.billing) return;
    setSubmitting(true);
    setError("");
    try {
      const dispute = await submitClientBillingDispute(input.eventId, {
        statementId: input.billing.id,
        milestoneId: milestoneId || undefined,
        amount: Number(amount),
        reason,
      });
      setCreated((current) => [dispute, ...current]);
      setAmount("");
      setReason("");
      setMilestoneId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the billing dispute.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    amount,
    reason,
    milestoneId,
    submitting,
    error,
    disputes: [...created, ...input.disputes],
    setAmount,
    setReason,
    setMilestoneId,
    submit,
  };
}
