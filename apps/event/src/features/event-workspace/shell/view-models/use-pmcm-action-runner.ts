"use client";

import { useCallback, useState } from "react";

type ActionTask = () => Promise<unknown>;
type RefreshTask = () => Promise<unknown>;

export function usePmcmActionRunner({
  onRefreshPortal,
  refreshApprovals,
  refreshDefenseReadiness,
  refreshEventReadiness,
  refreshSelectedEventWorkspace,
  selectedEventId,
  setError,
}: {
  onRefreshPortal: RefreshTask;
  refreshApprovals: RefreshTask;
  refreshDefenseReadiness: (eventId?: string | null) => Promise<unknown>;
  refreshEventReadiness: (eventId?: string | null) => Promise<unknown>;
  refreshSelectedEventWorkspace: (eventId?: string | null) => Promise<unknown>;
  selectedEventId?: string | null;
  setError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (labelText: string, action: ActionTask) => {
      setBusy(labelText);
      setError(null);
      try {
        await action();
        await onRefreshPortal();
        await refreshApprovals();
        if (selectedEventId) {
          await refreshSelectedEventWorkspace(selectedEventId).catch(() => undefined);
          void refreshDefenseReadiness(selectedEventId).catch(() => undefined);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Action failed");
      } finally {
        setBusy(null);
      }
    },
    [onRefreshPortal, refreshApprovals, refreshDefenseReadiness, refreshSelectedEventWorkspace, selectedEventId, setError],
  );

  const runLiveOps = useCallback(
    async (labelText: string, action: ActionTask) => {
      setBusy(labelText);
      setError(null);
      try {
        await action();
        await onRefreshPortal();
        await refreshSelectedEventWorkspace().catch(() => undefined);
        await refreshEventReadiness();
        await refreshApprovals();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Action failed");
      } finally {
        setBusy(null);
      }
    },
    [onRefreshPortal, refreshApprovals, refreshEventReadiness, refreshSelectedEventWorkspace, setError],
  );

  return {
    busy,
    run,
    runLiveOps,
  };
}
