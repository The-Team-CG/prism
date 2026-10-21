import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrismDecisionLog, PrismDecisionLogKind } from "@prism/types";
import { loadDecisionLog } from "../use-cases/load-decision-log";
import { decisionLogKindOptions } from "../model/decision-log-kinds";

export const DECISION_LOG_PAGE_SIZE = 25;

export function useDecisionLogViewModel(eventId: string) {
  const [kind, setKindState] = useState<PrismDecisionLogKind | null>(null);
  const [page, setPage] = useState(0);
  const [log, setLog] = useState<PrismDecisionLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setLog(await loadDecisionLog(eventId, { kind: kind ?? undefined, page, pageSize: DECISION_LOG_PAGE_SIZE }));
    } catch (cause) {
      setLog(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [eventId, kind, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Changing the kind filter always restarts paging from the newest decisions. */
  const setKind = useCallback((value: PrismDecisionLogKind | "all") => {
    setKindState(value === "all" ? null : value);
    setPage(0);
  }, []);

  const kindOptions = useMemo(() => decisionLogKindOptions(log), [log]);

  return {
    log,
    entries: log?.entries ?? [],
    kind,
    kindOptions,
    page,
    hasPrevious: page > 0,
    hasMore: log?.page.hasMore ?? false,
    loading,
    error,
    setKind,
    nextPage: () => setPage((current) => current + 1),
    previousPage: () => setPage((current) => Math.max(0, current - 1)),
    reload,
  };
}
