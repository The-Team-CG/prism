import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrismPmcmSupplierReadinessBoard } from "@prism/types";
import { loadPmcmSupplierReadiness } from "../use-cases/load-pmcm-supplier-readiness";
import { categoriesWithSupplierGap, supplierGapHardBlockCopy } from "../model/pmcm-supplier-readiness-rules";

export function usePmcmSupplierReadinessViewModel(eventId: string, refreshKey = "") {
  const [board, setBoard] = useState<PrismPmcmSupplierReadinessBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setLoading(true);
    try {
      const next = await loadPmcmSupplierReadiness(eventId);
      if (latestRequest.current !== requestId) return;
      setError(null);
      setBoard(next);
    } catch (cause) {
      if (latestRequest.current !== requestId) return;
      setBoard(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (latestRequest.current === requestId) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const gapCopy = useMemo(
    () => (board ? supplierGapHardBlockCopy(categoriesWithSupplierGap(board.items)) : null),
    [board],
  );

  return { board, gapCopy, error, loading, reload };
}
