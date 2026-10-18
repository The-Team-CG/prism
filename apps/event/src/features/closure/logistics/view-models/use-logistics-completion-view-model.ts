"use client";

import { useEffect, useState } from "react";
import type { PrismLogisticsCompletion } from "@prism/types";
import { logisticsCompletionRepository } from "../data/logistics-completion-repository";
import { buildLogisticsCompletionInput, type LogisticsCompletionDraft } from "../model/logistics-completion-rules";

export function useLogisticsCompletionViewModel(eventId: string) {
  const [record, setRecord] = useState<PrismLogisticsCompletion | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    logisticsCompletionRepository
      .get(eventId)
      .then((next) => { if (active) setRecord(next); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load logistics completion."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [eventId]);

  async function submit(draft: LogisticsCompletionDraft) {
    const result = buildLogisticsCompletionInput(draft, record !== null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setRecord(await logisticsCompletionRepository.record(eventId, result.input));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record logistics completion.");
    } finally {
      setBusy(false);
    }
  }

  return { record, loaded, busy, error, submit };
}
