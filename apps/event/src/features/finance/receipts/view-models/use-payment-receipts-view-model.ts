"use client";

import { useCallback, useMemo, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import type { PrismPaymentReceipt } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { paymentAllocationTargets, paymentReceipts, receiptsRepository } from "../data/receipts-repository";
import { filterToQuery, totalUnapplied, type ReceiptFilter } from "../model/receipt-rules";
import {
  submitAllocation,
  submitAllocationReversal,
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
  | { kind: "reverse-allocation"; recordId: string };

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
      await Promise.all([invalidate(paymentReceipts), invalidate(paymentAllocationTargets)]);
      toast.success(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [invalidate]);

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
    unappliedTotal: totalUnapplied(receipts),
    needsChecking: receipts.filter((receipt) => receipt.status === "recorded").length,
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
  };
}
