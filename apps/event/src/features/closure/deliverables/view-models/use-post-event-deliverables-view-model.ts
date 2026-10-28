"use client";
import { useEffect, useRef, useState } from "react";
import type { PrismPostEventDocument } from "@prism/types";
import { postEventDeliverablesRepository } from "../data/post-event-deliverables-repository";

export function usePostEventDeliverablesViewModel(eventId: string, documents: PrismPostEventDocument[]) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    requestVersion.current += 1;
    setCompleted([]); setError(null); setBusy(null);
    return () => { requestVersion.current += 1; };
  }, [eventId]);
  async function complete(id: string) {
    if (busy) return;
    const version = requestVersion.current;
    setBusy(id); setError(null);
    try {
      await postEventDeliverablesRepository.complete(eventId, id);
      if (version === requestVersion.current) setCompleted((current) => [...current, id]);
    } catch (cause) { if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : "Could not complete this deliverable."); }
    finally { if (version === requestVersion.current) setBusy(null); }
  }
  return { documents: documents.filter((document) => document.eventId === eventId), completed, busy, error, complete };
}
