"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismPmcmEventWorkspace } from "@prism/types";

type LoadPmcmEventWorkspace = (eventId: string) => Promise<PrismPmcmEventWorkspace>;

export function usePmcmSelectedEventWorkspace({
  eventId,
  loadWorkspace,
  onError,
}: {
  eventId?: string | null;
  loadWorkspace: LoadPmcmEventWorkspace;
  onError?: (error: unknown) => void;
}) {
  const [workspace, setWorkspace] = useState<PrismPmcmEventWorkspace | null>(null);

  const refresh = useCallback(
    async (nextEventId = eventId) => {
      if (!nextEventId) {
        setWorkspace(null);
        return null;
      }

      const next = await loadWorkspace(nextEventId);
      setWorkspace(next);
      return next;
    },
    [eventId, loadWorkspace],
  );

  useEffect(() => {
    if (!eventId) {
      setWorkspace(null);
      return;
    }

    let cancelled = false;
    loadWorkspace(eventId)
      .then((next) => {
        if (!cancelled) setWorkspace(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkspace(null);
          onError?.(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, loadWorkspace, onError]);

  return { refresh, workspace };
}
