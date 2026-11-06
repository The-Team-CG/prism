"use client";

import { useCallback, useState } from "react";
import type { PrismFloorPlanSnapshotVersion } from "@prism/types";
import { loadFloorplanSnapshotHistory } from "../use-cases/load-floorplan-snapshot-history";

/** Shown instead of any transport error text, which can be an HTML error page. */
export const SNAPSHOT_HISTORY_LOAD_FAILED = "Snapshot history couldn't be loaded. Try again.";

export function useFloorplanSnapshotHistoryViewModel(eventId: string, draftId: string) {
  const [history, setHistory] = useState<PrismFloorPlanSnapshotVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(null);
    try { setHistory(await loadFloorplanSnapshotHistory(eventId, draftId)); }
    catch { setError(SNAPSHOT_HISTORY_LOAD_FAILED); }
    finally { setLoading(false); }
  }, [eventId, draftId, loading]);
  return { history, loading, error, load };
}
