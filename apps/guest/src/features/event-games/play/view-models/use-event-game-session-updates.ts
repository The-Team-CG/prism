"use client";

import { useCallback, useEffect, useRef } from "react";

export const EVENT_GAME_SESSION_UPDATE_INTERVAL_MS = 30_000;
const MAX_RETRY_DELAY_MS = 120_000;

export function useEventGameSessionUpdates({
  enabled,
  refresh,
}: {
  enabled: boolean;
  refresh: () => Promise<boolean | void>;
}) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const runRefresh = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = (async () => {
      try {
        return (await refreshRef.current()) !== false;
      } catch {
        return false;
      }
    })();
    inFlightRef.current = request;
    void request.finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
    });
    return request;
  }, []);
  const triggerRef = useRef<() => Promise<boolean>>(runRefresh);

  useEffect(() => {
    if (!enabled) {
      triggerRef.current = runRefresh;
      return;
    }

    let disposed = false;
    let pollInFlight = false;
    let refreshAgain = false;
    let failures = 0;
    let timer: number | undefined;
    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      if (disposed || isDocumentHidden()) return;
      clearTimer();
      const delay = Math.min(EVENT_GAME_SESSION_UPDATE_INTERVAL_MS * 2 ** failures, MAX_RETRY_DELAY_MS);
      timer = window.setTimeout(() => { void poll(); }, delay);
    };
    const poll = async (): Promise<boolean> => {
      clearTimer();
      if (disposed || isDocumentHidden()) return false;
      if (pollInFlight) {
        refreshAgain = true;
        return false;
      }
      pollInFlight = true;
      const succeeded = await runRefresh();
      pollInFlight = false;
      if (disposed) return succeeded;
      if (refreshAgain && !isDocumentHidden()) {
        refreshAgain = false;
        void poll();
        return succeeded;
      }
      failures = succeeded ? 0 : Math.min(failures + 1, 3);
      schedule();
      return succeeded;
    };
    const onVisibilityChange = () => {
      if (isDocumentHidden()) {
        clearTimer();
        return;
      }
      clearTimer();
      if (pollInFlight) refreshAgain = true;
      else void poll();
    };

    triggerRef.current = poll;
    timer = window.setTimeout(() => { void poll(); }, EVENT_GAME_SESSION_UPDATE_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      disposed = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
      triggerRef.current = runRefresh;
    };
  }, [enabled, runRefresh]);

  return useCallback(() => triggerRef.current(), []);
}

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}
