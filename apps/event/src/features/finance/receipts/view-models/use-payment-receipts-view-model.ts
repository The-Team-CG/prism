"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import type { PrismPaymentReceipt } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { financeDesk } from "@/features/finance/desk";
import { useListFilter } from "@/features/pmcm-kit";
import { paymentAllocationTargets, paymentReceipts, receiptsRepository } from "../data/receipts-repository";
import { filterToQuery, type ReceiptFilter } from "../model/receipt-rules";
import {
  submitAllocation,
  submitAllocationReversal,
  submitEarmark,
  submitEvidence,
  submitReceipt,
  submitReceiptReversal,
  submitRefund,
  submitRejection,
  submitVerification,
  type ReceiptDraft,
  type RefundDraft,
} from "../use-cases/receipt-commands";

export type ReceiptDialog =
  | { kind: "record" }
  | { kind: "allocate" }
  | { kind: "verify" }
  | { kind: "reject" }
  | { kind: "reverse" }
  | { kind: "refund" }
  | { kind: "evidence" }
  | { kind: "earmark" }
  | { kind: "reverse-allocation"; recordId: string };

function saveFile(file: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type PaymentReceiptsViewModel = ReturnType<typeof usePaymentReceiptsViewModel>;

/** The receipts desk: one filtered list, one selected receipt, and the dialogs that change it. */
export function usePaymentReceiptsViewModel() {
  const [filter, setFilter] = useState<ReceiptFilter>("unapplied");
  const query = useMemo(() => filterToQuery(filter), [filter]);
  const list = useResource(paymentReceipts, query);
  const invalidate = useInvalidate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The receipt as a command last returned it, so the detail never shows a stale copy while the list refetches.
  const [latest, setLatest] = useState<PrismPaymentReceipt | null>(null);
  const [dialog, setDialog] = useState<ReceiptDialog | null>(null);
  // A link from the finance desk, the inbox or an event's billing opens straight on one receipt.
  const [linkedReceipt] = useListFilter("receipt", "");
  useEffect(() => {
    if (!linkedReceipt) return;
    setFilter("all");
    setSelectedId(linkedReceipt);
  }, [linkedReceipt]);
  // Totals come from the desk, so they count every receipt whatever the list is filtered to.
  const totals = useResource(financeDesk, "signed-in").data?.totals;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receipts = useMemo(() => list.data ?? [], [list.data]);
  const selected = latest?.id === selectedId ? latest : receipts.find((receipt) => receipt.id === selectedId) ?? null;

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setLatest(null);
    setError(null);
  }, []);

  const openDialog = useCallback((next: ReceiptDialog) => { setError(null); setDialog(next); }, []);
  const closeDialog = useCallback(() => { setError(null); setDialog(null); }, []);

  const run = useCallback(async (message: string, action: () => Promise<PrismPaymentReceipt>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setLatest(result);
      setSelectedId(result.id);
      setDialog(null);
      await Promise.all([invalidate(paymentReceipts), invalidate(paymentAllocationTargets), invalidate(financeDesk)]);
      toast.success(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [invalidate]);

  const openEvidence = useCallback(async () => {
    const objectId = selected?.evidence?.objectId;
    if (!objectId) return;
    try {
      saveFile(await receiptsRepository.downloadEvidence(objectId));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not open the proof. Try again.");
    }
  }, [selected]);

  const onSelected = useCallback(
    (message: string, action: (receiptId: string) => Promise<PrismPaymentReceipt>) =>
      selected ? run(message, () => action(selected.id)) : Promise.resolve(false),
    [run, selected],
  );

  return {
    filter,
    setFilter,
    status: list.status,
    loadError: list.status === "error" ? list.error.message : null,
    receipts,
    selected,
    unappliedTotal: totals?.unapplied ?? 0,
    needsChecking: totals?.toVerifyCount ?? 0,
    select,
    dialog,
    openDialog,
    closeDialog,
    busy,
    error,
    record: (draft: ReceiptDraft) => run("Receipt recorded", () => submitReceipt(receiptsRepository, draft)),
    allocate: (draft: { milestoneId: string; amount: string }) =>
      onSelected("Money applied to the milestone", (id) => submitAllocation(receiptsRepository, id, draft)),
    reverseAllocation: (recordId: string, reason: string) =>
      onSelected("Payment undone", (id) => submitAllocationReversal(receiptsRepository, id, recordId, reason)),
    verify: (notes: string) => onSelected("Receipt verified", (id) => submitVerification(receiptsRepository, id, notes)),
    reject: (reason: string) => onSelected("Receipt rejected", (id) => submitRejection(receiptsRepository, id, reason)),
    reverse: (reason: string) => onSelected("Receipt reversed", (id) => submitReceiptReversal(receiptsRepository, id, reason)),
    refund: (draft: RefundDraft) => onSelected("Refund recorded", (id) => submitRefund(receiptsRepository, id, draft)),
    attachEvidence: (file: File | null) => (selected ? run("Proof of payment attached", () => submitEvidence(receiptsRepository, selected, file)) : Promise.resolve(false)),
    earmark: (eventId: string) => onSelected("Receipt assigned to the event", (id) => submitEarmark(receiptsRepository, id, eventId)),
    openEvidence,
  };
}
