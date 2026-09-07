"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateComplianceRiskInput, PrismComplianceRisk, PrismComplianceRun } from "@prism/types";
import { complianceReviewRepository } from "../data/compliance-review-repository";
import { createComplianceRisk } from "../use-cases/create-compliance-risk";

export function useComplianceReviewViewModel(eventId: string) {
  const [runs, setRuns] = useState<PrismComplianceRun[]>([]);
  const [risks, setRisks] = useState<PrismComplianceRisk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      const [nextRuns, nextRisks] = await Promise.all([complianceReviewRepository.listRuns(eventId), complianceReviewRepository.listRisks(eventId)]);
      setRuns(nextRuns); setRisks(nextRisks); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load compliance history."); }
  }, [eventId]);
  useEffect(() => { void reload(); }, [reload]);
  const addRisk = useCallback(async (input: CreateComplianceRiskInput) => {
    setBusy(true);
    try { await createComplianceRisk(eventId, input); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save compliance risk."); }
    finally { setBusy(false); }
  }, [eventId, reload]);
  return { runs, risks, error, busy, reload, addRisk, latestRun: runs[0] ?? null };
}
