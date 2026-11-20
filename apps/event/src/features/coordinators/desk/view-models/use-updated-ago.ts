"use client";

import { useEffect, useState } from "react";

/** "Updated just now", "Updated 25 s ago", "Updated 3 min ago". */
export function updatedAgoLabel(seconds: number): string {
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${Math.floor(seconds / 10) * 10} s ago`;
  return `Updated ${Math.floor(seconds / 60)} min ago`;
}

/**
 * How long ago `value` last changed, ticking every few seconds, so a coordinator on patchy signal can see whether what
 * they are looking at is current. Pass the loaded data itself: a new object counts as a fresh load.
 */
export function useUpdatedAgo(value: unknown, tickMs = 5000): { seconds: number; label: string } {
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const at = Date.now();
    setLoadedAt(at);
    setNow(at);
  }, [value]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs]);
  const seconds = Math.max(0, Math.round((now - loadedAt) / 1000));
  return { seconds, label: updatedAgoLabel(seconds) };
}
