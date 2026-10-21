"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismEventRiskView, RecordEventRiskAssessmentInput } from "@prism/types";
import { riskAssessmentRepository } from "../data/risk-assessment-repository";
import { recordRiskAssessmentUseCase } from "../use-cases/risk-assessment-use-cases";

export function useRiskAssessmentViewModel(eventId: string) {
  const [view, setView] = useState<PrismEventRiskView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setView(await riskAssessmentRepository.load(eventId));
      setStatus("ready");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to load the risk assessment.");
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => { void reload(); }, [reload]);

  const record = useCallback(async (draft: RecordEventRiskAssessmentInput) => {
    setBusy(true);
    setError(null);
    try {
      setView(await recordRiskAssessmentUseCase(eventId, draft, view?.assessment?.level ?? null));
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The risk level could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [eventId, view]);

  return { view, status, error, busy, reload, record };
}
