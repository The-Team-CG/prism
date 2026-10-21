"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismClientChangeRequest, SubmitScopeChangeRequestInput } from "@prism/types";
import { clientChangeRequestRepository } from "../data/client-change-request-repository";
import { submitScopeChangeUseCase, withdrawScopeChangeUseCase } from "../use-cases/client-scope-change-use-cases";

export function useClientChangeRequestsViewModel(eventId: string) {
  const [requests, setRequests] = useState<PrismClientChangeRequest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (active: () => boolean = () => true) => {
    setStatus("loading");
    setError(null);
    try {
      const next = await clientChangeRequestRepository.list(eventId);
      if (!active()) return;
      setRequests(next);
      setStatus("ready");
    } catch (cause: unknown) {
      if (!active()) return;
      setError(cause instanceof Error ? cause.message : "Unable to load change requests.");
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => {
    let active = true;
    void reload(() => active);
    return () => { active = false; };
  }, [reload]);

  // Actions surface their own error and then refresh the list, so the panel always shows the server's state.
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The change request could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return {
    requests,
    status,
    error,
    busy,
    submitScopeChange: (draft: SubmitScopeChangeRequestInput) => run(() => submitScopeChangeUseCase(eventId, draft)),
    withdrawScopeChange: (requestId: string) => run(() => withdrawScopeChangeUseCase(eventId, requestId)),
  };
}
