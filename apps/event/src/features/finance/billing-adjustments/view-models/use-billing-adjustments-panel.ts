"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PrismAdditionalBilling,
  PrismBillingCorrection,
  PrismBillingDispute,
  PrismBillingSource,
  PrismBillingStatement,
  PrismPaymentMilestone,
} from "@prism/types";
import { billingAdjustmentRepository } from "../data/billing-adjustment-repository";
import { approvedBillingSources } from "../model/billing-adjustment-rules";
import {
  submitAdditionalBilling,
  submitAdditionalBillingWaiver,
  submitBillingCorrection,
  submitBillingDispute,
  submitDisputeResolution,
} from "../use-cases/submit-billing-adjustment";

export function useBillingAdjustmentsPanel({
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
  const [disputes, setDisputes] = useState<PrismBillingDispute[]>([]);
  const [corrections, setCorrections] = useState<PrismBillingCorrection[]>([]);
  const [additionalBillings, setAdditionalBillings] = useState<PrismAdditionalBilling[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const currentEventId = useRef(eventId);
  currentEventId.current = eventId;

  const statement = statements.find((item) => item.eventId === eventId);
  const approvedSources = approvedBillingSources(billingSources.filter((source) => source.eventId === eventId));

  const [disputeDraft, setDisputeDraft] = useState({ milestoneId: "", amount: "", reason: "" });
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [correctionDraft, setCorrectionDraft] = useState({ reason: "", correctedTotalAmount: "" });
  const [additionalDraft, setAdditionalDraft] = useState({ urgentIssueId: "", billingSourceId: "", description: "", amount: "" });
  const [waiverReasons, setWaiverReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const requestedEventId = eventId;
    try {
      const workspace = await billingAdjustmentRepository.loadBilling();
      if (currentEventId.current !== requestedEventId) return;
      setDisputes((workspace.billingDisputes ?? []).filter((row) => row.eventId === requestedEventId));
      setCorrections((workspace.billingCorrections ?? []).filter((row) => row.eventId === requestedEventId));
      setAdditionalBillings((workspace.additionalBillings ?? []).filter((row) => row.eventId === requestedEventId));
      setError(null);
    } catch (cause) {
      if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : "Could not load billing adjustments.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  /** Runs one command, then reloads adjustments. Local rule and schema failures surface as the error message. */
  async function act(label: string, command: () => Promise<unknown>, onDone?: () => void) {
    const requestedEventId = eventId;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await command();
      if (currentEventId.current !== requestedEventId) return;
      onDone?.();
      setNotice(`${label} recorded.`);
      await load();
    } catch (cause) {
      if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : `Could not record ${label.toLowerCase()}.`);
    } finally {
      if (currentEventId.current === requestedEventId) setBusy(false);
    }
  }

  return {
    statement,
    payments: payments.filter((payment) => payment.eventId === eventId),
    approvedSources,
    disputes,
    corrections,
    additionalBillings,
    busy,
    error,
    notice,
    disputeDraft,
    setDisputeDraft,
    correctionDraft,
    setCorrectionDraft,
    additionalDraft,
    setAdditionalDraft,
    resolutionNotes,
    setResolutionNotes,
    waiverReasons,
    setWaiverReasons,
    submitDispute: () => {
      if (!statement) { setError("Billing statement is required before recording a dispute."); return Promise.resolve(); }
      return act("Dispute", () => submitBillingDispute(billingAdjustmentRepository, eventId, {
        statementId: statement.id,
        milestoneId: disputeDraft.milestoneId || undefined,
        amount: Number(disputeDraft.amount),
        reason: disputeDraft.reason,
        statementTotal: statement.totalAmount,
      }), () => setDisputeDraft({ milestoneId: "", amount: "", reason: "" }));
    },
    resolveDispute: (disputeId: string, action: "resolve" | "reject") =>
      act("Dispute resolution", () => submitDisputeResolution(billingAdjustmentRepository, eventId, disputeId, {
        action,
        resolutionNotes: resolutionNotes[disputeId] ?? "",
      }), () => setResolutionNotes((current) => ({ ...current, [disputeId]: "" }))),
    submitCorrection: () => {
      if (!statement) { setError("Billing statement is required before requesting a correction."); return Promise.resolve(); }
      return act("Correction", () => submitBillingCorrection(billingAdjustmentRepository, eventId, {
        statementId: statement.id,
        reason: correctionDraft.reason,
        correctedTotalAmount: correctionDraft.correctedTotalAmount ? Number(correctionDraft.correctedTotalAmount) : undefined,
      }), () => setCorrectionDraft({ reason: "", correctedTotalAmount: "" }));
    },
    submitAdditionalBilling: () =>
      act("Additional billing", () => submitAdditionalBilling(billingAdjustmentRepository, eventId, {
        urgentIssueId: additionalDraft.urgentIssueId,
        billingSourceId: additionalDraft.billingSourceId,
        description: additionalDraft.description,
        amount: Number(additionalDraft.amount),
      }), () => setAdditionalDraft({ urgentIssueId: "", billingSourceId: "", description: "", amount: "" })),
    waiveAdditionalBilling: (additionalBillingId: string) =>
      act("Waiver", () => submitAdditionalBillingWaiver(
        billingAdjustmentRepository,
        eventId,
        additionalBillingId,
        waiverReasons[additionalBillingId] ?? "",
      ), () => setWaiverReasons((current) => ({ ...current, [additionalBillingId]: "" }))),
  };
}
