"use client";

import { useState } from "react";
import { useInvalidate } from "@prism/portal-query";
import { PAYMENT_RECEIPT_METHODS, type PrismStatementMilestone } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import { clientPaymentRepository } from "../data/client-payment-repository";
import { clientStatementOfAccount, clientStatementsOfAccount } from "../data/statement-of-account-resource";
import { owedNow } from "../model/client-money-rules";
import { addPaymentProof, reportClientPayment, type ReportPaymentDraft } from "../use-cases/report-client-payment";

const emptyDraft = (): ReportPaymentDraft => ({ amount: "", paidDate: manilaDateKey(), method: PAYMENT_RECEIPT_METHODS[0], referenceNumber: "", milestoneId: "", note: "", proof: null });

/** The "I've paid" form: which payment, how much, when, how, the reference, and the proof. */
export function useReportPaymentViewModel(eventId: string, milestones: PrismStatementMilestone[]) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReportPaymentDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proofBusyId, setProofBusyId] = useState<string | null>(null);

  async function refresh() {
    await Promise.all([invalidate(clientStatementOfAccount, eventId), invalidate(clientStatementsOfAccount)]);
  }

  /** Open the form for one payment, with what is still owed on it filled in. */
  function start(milestoneId?: string) {
    const target = milestones.find((milestone) => milestone.id === milestoneId) ?? milestones.find((milestone) => owedNow(milestone) > 0);
    setDraft({ ...emptyDraft(), milestoneId: target?.id ?? "", amount: target ? String(owedNow(target)) : "" });
    setError(null);
    setOpen(true);
  }

  function update<K extends keyof ReportPaymentDraft>(key: K, value: ReportPaymentDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await reportClientPayment(eventId, draft);
      setOpen(false);
      setNotice(result.proofError ?? "Sent to PMCM. They will check it against their bank or wallet statement and let you know.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your payment details.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Add proof to a payment already reported whose proof did not upload. */
  async function addProof(receiptId: string, file: File) {
    setProofBusyId(receiptId);
    setNotice(null);
    try {
      await addPaymentProof(clientPaymentRepository, eventId, receiptId, file);
      setNotice("Proof added. PMCM will check it.");
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not add the proof.");
    } finally {
      setProofBusyId(null);
    }
  }

  return { open, setOpen, draft, update, start, submit, submitting, error, notice, dismissNotice: () => setNotice(null), addProof, proofBusyId };
}

export type ReportPaymentViewModel = ReturnType<typeof useReportPaymentViewModel>;
