"use client";

import { useEffect } from "react";

export const EVENT_DAY_LIVE_UPDATE_INTERVAL_MS = 30_000;

export function useEventDayLiveUpdates({
  enabled,
  refresh,
  refreshOnEnable = true,
}: {
  enabled: boolean;
  refresh: () => Promise<unknown>;
  refreshOnEnable?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    let refreshInFlight = false;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "hidden" || refreshInFlight) return;
      refreshInFlight = true;
      void refresh()
        .catch(() => undefined)
        .finally(() => {
          refreshInFlight = false;
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshWhenVisible();
    };

    if (refreshOnEnable) refreshWhenVisible();
    const intervalId = window.setInterval(
      refreshWhenVisible,
      EVENT_DAY_LIVE_UPDATE_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, refresh, refreshOnEnable]);
}
