"use client";

import { useEffect, useRef, useState } from "react";
import { clientFilesLastSeenStore } from "../data/client-files-last-seen-store";

/**
 * When the client previously opened this event's files, read once per visit before this visit is recorded, so
 * files PMCM added in between can be marked new. Null on a first visit or when browser storage is unavailable.
 */
export function useClientFilesLastSeen(actorId: string | undefined, eventId: string | null): string | null {
  const recorded = useRef(new Set<string>());
  const [previous, setPrevious] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!actorId || !eventId) return;
    const visit = `${actorId}:${eventId}`;
    // Record each event once per mount; a repeated effect run must not read back the visit it just wrote.
    if (recorded.current.has(visit)) return;
    recorded.current.add(visit);
    const before = clientFilesLastSeenStore.get(actorId, eventId);
    clientFilesLastSeenStore.set(actorId, eventId, new Date().toISOString());
    setPrevious((current) => ({ ...current, [eventId]: before }));
  }, [actorId, eventId]);

  return eventId ? previous[eventId] ?? null : null;
}
