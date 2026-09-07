"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismSupplierApplication, ReviewSupplierApplicationInput } from "@prism/types";
import { supplierApplicationsRepository } from "../data/supplier-applications-repository";

export function useSupplierApplicationsInboxViewModel() {
  const [items, setItems] = useState<PrismSupplierApplication[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setItems(await supplierApplicationsRepository.listInbox());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load applications.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(applicationId: string, action: ReviewSupplierApplicationInput["action"]) {
    setBusy(true);
    setError(null);
    try {
      const input: ReviewSupplierApplicationInput =
        action === "decline" ? { action, declineReason } : { action };
      await supplierApplicationsRepository.review(applicationId, input);
      setDeclineReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update application.");
      setBusy(false);
    }
  }

  return { items, busy, error, declineReason, setDeclineReason, review };
}
