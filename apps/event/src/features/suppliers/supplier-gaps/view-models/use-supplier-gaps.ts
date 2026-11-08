"use client";

import { useCallback, useEffect, useState } from "react";
import { acknowledgeSupplierGapSchema, parseContract, type PrismSupplierGap } from "@prism/types";
import { supplierGapsRepository } from "../data/supplier-gaps-repository";

export function useSupplierGaps(eventId: string, refreshKey?: string) {
  const [gaps, setGaps] = useState<PrismSupplierGap[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGaps(await supplierGapsRepository.list(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load supplier gaps.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function acknowledge(categoryId: string) {
    setBusy(categoryId);
    setError(null);
    try {
      const input = parseContract(acknowledgeSupplierGapSchema, { reason: reasons[categoryId] ?? "" }, "Supplier gap acknowledgement");
      await supplierGapsRepository.acknowledge(eventId, categoryId, input);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not acknowledge the gap.");
    } finally {
      setBusy(null);
    }
  }

  return {
    gaps: gaps.filter((gap) => gap.gap),
    reasons,
    setReason: (categoryId: string, value: string) => setReasons((current) => ({ ...current, [categoryId]: value })),
    busy,
    error,
    acknowledge,
  };
}
