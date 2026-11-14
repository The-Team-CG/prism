"use client";

import { useEffect, useRef } from "react";

export const CHAT_REFRESH_INTERVAL_MS = 15_000;

/**
 * Runs `refresh` every 15 seconds while the tab is visible, and again when the tab is shown or the window regains
 * focus. Hidden tabs do not poll. A failed run is dropped, so the caller keeps what is already on screen.
 */
export function useVisibleRefresh(refresh: () => Promise<unknown>, enabled: boolean) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useEffect(() => {
    if (!enabled) return;
    let pending = false;
    const run = async () => {
      if (document.visibilityState === "hidden" || pending) return;
      pending = true;
      try {
        await latest.current();
      } catch {
        // Keep the conversations already shown; the next run tries again.
      } finally {
        pending = false;
      }
    };
    const onShown = () => {
      if (document.visibilityState !== "hidden") void run();
    };
    const timer = window.setInterval(() => void run(), CHAT_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onShown);
    window.addEventListener("focus", onShown);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener("focus", onShown);
    };
  }, [enabled]);
}
