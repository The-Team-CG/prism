"use client";

import { useState } from "react";
import { useInvalidate } from "@prism/portal-query";
import type { PrismSupplierPayoutRecord } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { supplierWorkflowRepository } from "../data/supplier-workflow-repository";
import { supplierWorkspaceResource } from "../data/supplier-workspace-resource";
import { loadSupplierDashboardSession } from "../use-cases/supplier-workspace-actions";

export type PayoutReceiptTarget = { record: PrismSupplierPayoutRecord; eventId: string; label: string; alreadyConfirmed: boolean };

/** "I received this": the supplier confirms a transfer, optionally with their official receipt, and PMCM is told. */
export function usePayoutReceipt(supplierId: string) {
  const invalidate = useInvalidate();
  const [target, setTarget] = useState<PayoutReceiptTarget | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(next: PayoutReceiptTarget) {
    setTarget(next);
    setFile(null);
    setError(null);
  }

  async function submit() {
    const session = loadSupplierDashboardSession();
    if (!target || !session) return;
    if (target.alreadyConfirmed && !file) return setError("Choose your official receipt to send.");
    setBusy(true);
    try {
      await supplierWorkflowRepository.confirmPayoutReceived(session, supplierId, target.eventId, target.record.id, file ?? undefined);
      toast.success(file ? "Thanks. PMCM has your official receipt." : "Thanks. PMCM knows the payment reached you.");
      setTarget(null);
      await invalidate(supplierWorkspaceResource);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return { target, open, close: () => setTarget(null), file, setFile, error, busy, submit };
}

export type PayoutReceiptViewModel = ReturnType<typeof usePayoutReceipt>;
