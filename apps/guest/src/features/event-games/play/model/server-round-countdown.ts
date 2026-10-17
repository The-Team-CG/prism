"use client";

import { useEffect, useState } from "react";

export function serverRoundSecondsRemaining(
  deadlineAt: string | null | undefined,
  serverTime: string | null | undefined,
  elapsedSinceSyncMs: number,
): number | null {
  if (!deadlineAt || !serverTime || !Number.isFinite(elapsedSinceSyncMs)) return null;
  const deadlineMs = Date.parse(deadlineAt);
  const serverMs = Date.parse(serverTime);
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(serverMs)) return null;
  const remainingMs = Math.max(0, deadlineMs - serverMs - Math.max(0, elapsedSinceSyncMs));
  return Math.ceil(remainingMs / 1000);
}

export function useServerRoundCountdown(
  deadlineAt: string | null | undefined,
  serverTime: string | null | undefined,
  paused: boolean,
): number | null {
  const [elapsedSinceSyncMs, setElapsedSinceSyncMs] = useState(0);
  useEffect(() => {
    setElapsedSinceSyncMs(0);
    if (!deadlineAt || !serverTime || paused) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setElapsedSinceSyncMs(performance.now() - startedAt);
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadlineAt, paused, serverTime]);
  return serverRoundSecondsRemaining(deadlineAt, serverTime, elapsedSinceSyncMs);
}
