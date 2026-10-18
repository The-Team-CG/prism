"use client";

import { useEffect, useState } from "react";
import type { PrismClientChangeRequest } from "@prism/types";
import { clientChangeRequestRepository } from "../data/client-change-request-repository";

export function useClientChangeRequestsViewModel(eventId: string) {
  const [requests, setRequests] = useState<PrismClientChangeRequest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    clientChangeRequestRepository.list(eventId)
      .then((next) => {
        if (!active) return;
        setRequests(next);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load change requests.");
        setStatus("error");
      });
    return () => { active = false; };
  }, [eventId]);

  return { requests, status, error };
}
