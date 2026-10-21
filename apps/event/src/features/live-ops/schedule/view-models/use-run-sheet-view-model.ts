import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrismEventRunSheet, PrismEventRunSheetResult } from "@prism/types";
import { loadRunSheet } from "../use-cases/load-run-sheet";
import { buildRunSheetTimeline } from "../model/run-sheet-timeline";

const NOW_TICK_MS = 30_000;

function isAuthored(result: PrismEventRunSheetResult | null): result is PrismEventRunSheet {
  return Boolean(result && "entries" in result);
}

export function useRunSheetViewModel(eventId: string) {
  const [dayId, setDayId] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<PrismEventRunSheetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    try {
      setError(null);
      const next = await loadRunSheet(eventId, dayId);
      if (request === latestRequest.current) setResult(next);
    } catch (cause) {
      if (request === latestRequest.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (request === latestRequest.current) {
        setLoading(false);
        setNow(new Date());
      }
    }
  }, [eventId, dayId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { setDayId(undefined); setResult(null); }, [eventId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const runSheet = isAuthored(result) ? result : null;
  const timeline = useMemo(() => (runSheet ? buildRunSheetTimeline(runSheet.entries, now) : null), [runSheet, now]);

  return {
    runSheet,
    unavailable: Boolean(result && !isAuthored(result)),
    timeline,
    now,
    loading,
    error,
    selectedDayId: runSheet?.day.id ?? dayId,
    selectDay: setDayId,
    reload,
  };
}

export type RunSheetViewModel = ReturnType<typeof useRunSheetViewModel>;
