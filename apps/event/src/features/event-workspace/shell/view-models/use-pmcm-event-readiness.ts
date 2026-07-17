"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismDefenseReadiness, PrismEventDayStatusFeed, PrismLiveOps } from "@prism/types";

type EventReadinessLoaders = {
  loadDefenseReadiness: (eventId: string) => Promise<PrismDefenseReadiness>;
  loadLiveOps: (eventId: string) => Promise<PrismLiveOps>;
  loadStatusFeed: (eventId: string) => Promise<PrismEventDayStatusFeed>;
};

export function usePmcmEventReadiness({
  eventId,
  loaders,
  onError,
}: {
  eventId?: string | null;
  loaders: EventReadinessLoaders;
  onError?: (error: unknown) => void;
}) {
  const [defenseReadiness, setDefenseReadiness] = useState<PrismDefenseReadiness | null>(null);
  const [liveOps, setLiveOps] = useState<PrismLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<PrismEventDayStatusFeed | null>(null);

  const clear = useCallback(() => {
    setDefenseReadiness(null);
    setLiveOps(null);
    setStatusFeed(null);
  }, []);

  const refresh = useCallback(
    async (nextEventId = eventId) => {
      if (!nextEventId) {
        clear();
        return null;
      }

      const [nextLiveOps, nextStatusFeed, nextDefenseReadiness] = await Promise.all([
        loaders.loadLiveOps(nextEventId),
        loaders.loadStatusFeed(nextEventId),
        loaders.loadDefenseReadiness(nextEventId),
      ]);
      setLiveOps(nextLiveOps);
      setStatusFeed(nextStatusFeed);
      setDefenseReadiness(nextDefenseReadiness);
      return {
        defenseReadiness: nextDefenseReadiness,
        liveOps: nextLiveOps,
        statusFeed: nextStatusFeed,
      };
    },
    [clear, eventId, loaders],
  );

  const refreshDefenseReadiness = useCallback(
    async (nextEventId = eventId) => {
      if (!nextEventId) {
        setDefenseReadiness(null);
        return null;
      }

      const next = await loaders.loadDefenseReadiness(nextEventId);
      setDefenseReadiness(next);
      return next;
    },
    [eventId, loaders],
  );

  useEffect(() => {
    if (!eventId) {
      clear();
      return;
    }

    let cancelled = false;
    Promise.all([loaders.loadLiveOps(eventId), loaders.loadStatusFeed(eventId), loaders.loadDefenseReadiness(eventId)])
      .then(([nextLiveOps, nextStatusFeed, nextDefenseReadiness]) => {
        if (cancelled) return;
        setLiveOps(nextLiveOps);
        setStatusFeed(nextStatusFeed);
        setDefenseReadiness(nextDefenseReadiness);
      })
      .catch((error) => {
        if (!cancelled) onError?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [clear, eventId, loaders, onError]);

  return {
    defenseReadiness,
    liveOps,
    refresh,
    refreshDefenseReadiness,
    statusFeed,
  };
}
