"use client";

import { useCallback, useState } from "react";
import type { SubmitScopeChangeRequestInput } from "@prism/types";
import { useInvalidate, useResource } from "@prism/portal-query";
import { clientEventChangeRequestsResource } from "../data/client-change-request-repository";
import { submitScopeChangeUseCase, withdrawScopeChangeUseCase } from "../use-cases/client-scope-change-use-cases";

export function useClientChangeRequestsViewModel(eventId: string) {
  const list = useResource(clientEventChangeRequestsResource, eventId);
  const invalidate = useInvalidate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Actions surface their own error and then refresh the list, so the panel always shows the server's state.
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await invalidate(clientEventChangeRequestsResource, eventId);
      return true;
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "The change request could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [eventId, invalidate]);

  return {
    requests: list.status === "error" ? [] : list.data ?? [],
    status: list.status === "pending" ? ("loading" as const) : list.status,
    error: actionError ?? (list.status === "error" ? list.error.message || "Unable to load change requests." : null),
    busy,
    submitScopeChange: (draft: SubmitScopeChangeRequestInput) => run(() => submitScopeChangeUseCase(eventId, draft)),
    withdrawScopeChange: (requestId: string) => run(() => withdrawScopeChangeUseCase(eventId, requestId)),
  };
}
