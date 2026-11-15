"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismLifecycleStage } from "@prism/types";
import { clientEventStageSeenStore } from "../data/client-event-stage-seen-store";
import { stageReachedMessage } from "../model/client-overview-glance";

/**
 * "Your event moved to Planning", once: compares the stage with the one recorded at the client's last visit, then
 * records this one, so the line shows on the first visit after a move and not again. `dismiss` hides it sooner.
 */
export function useClientStageReached(actorId: string | undefined, eventId: string, stage: PrismLifecycleStage) {
  const recorded = useRef(new Set<string>());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!actorId) return;
    const visit = `${actorId}:${eventId}:${stage}`;
    // Compare once per stage per mount; a repeated effect run must not read back the stage it just wrote.
    if (recorded.current.has(visit)) return;
    recorded.current.add(visit);
    const previous = clientEventStageSeenStore.get(actorId, eventId);
    if (previous !== stage) clientEventStageSeenStore.set(actorId, eventId, stage);
    setMessage(stageReachedMessage(previous, stage));
  }, [actorId, eventId, stage]);

  return { message, dismiss: () => setMessage(null) };
}
