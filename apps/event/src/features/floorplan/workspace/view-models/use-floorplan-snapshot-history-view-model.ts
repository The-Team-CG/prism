"use client";

import { useCallback, useState } from "react";
import type { PrismFloorPlanSnapshotVersion } from "@prism/types";
import { loadFloorplanSnapshotHistory } from "../use-cases/load-floorplan-snapshot-history";

export function useFloorplanSnapshotHistoryViewModel(eventId: string, draftId: string) {
  const [history, setHistory] = useState<PrismFloorPlanSnapshotVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(null);
    try { setHistory(await loadFloorplanSnapshotHistory(eventId, draftId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load layout history."); }
    finally { setLoading(false); }
  }, [eventId, draftId, loading]);
  return { history, loading, error, load };
}
