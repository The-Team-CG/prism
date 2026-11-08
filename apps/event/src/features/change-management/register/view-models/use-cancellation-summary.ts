"use client";

import { useEffect, useState } from "react";
import type { PrismCancellationSummary } from "@prism/types";
import { changeRegisterRepository } from "../data/change-register-repository";

/** FR-96: loads the cancellation financial summary once PMCM chooses to cancel. */
export function useCancellationSummary(eventId: string, enabled: boolean) {
  const [summary, setSummary] = useState<PrismCancellationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    changeRegisterRepository.cancellationSummary(eventId).then(
      (result) => { if (current) setSummary(result); },
      (caught: unknown) => { if (current) setError(caught instanceof Error ? caught.message : "Could not load the cancellation summary."); },
    );
    return () => { current = false; };
  }, [eventId, enabled]);
  return { summary, error };
}
