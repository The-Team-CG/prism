"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrismEventDecision } from "@prism/types";
import { eventDecisionRepository } from "../data/event-decision-repository";
import { effectivePostponementSnapshot } from "../model/postponement-impact-rules";

export function usePostponementImpactViewModel(eventId: string) {
  const [decisions, setDecisions] = useState<PrismEventDecision[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus("loading");
    setError(null);
    try {
      const next = await eventDecisionRepository.list(eventId);
      if (requestVersion.current !== version) return;
      setDecisions(next);
      setStatus("ready");
    } catch (cause) {
      if (requestVersion.current !== version) return;
      setError(cause instanceof Error ? cause.message : "Unable to load postponement details.");
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => {
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);

  const effectiveSnapshot = useMemo(
    () => effectivePostponementSnapshot(decisions),
    [decisions],
  );

  return { status, error, effectiveSnapshot, reload };
}
