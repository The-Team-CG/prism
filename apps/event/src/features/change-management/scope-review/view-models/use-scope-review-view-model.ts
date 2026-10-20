"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismAddendum, PrismEventFreezeException, PrismScopeChangeRequest, ScopeChangeImpactInput } from "@prism/types";
import { unusedApprovedExceptions } from "../../register/model/change-register-rules";
import { scopeReviewRepository } from "../data/scope-review-repository";
import { reviewScopeChangeUseCase } from "../use-cases/scope-review-use-cases";

export type ApprovalDraft = {
  impacts: ScopeChangeImpactInput;
  impactReviewConfirmed: boolean;
  freezeExceptionId?: string;
  addendumId?: string;
  clientResponse?: string;
};

export function useScopeReviewViewModel(eventId: string, options: { frozen: boolean }) {
  const [requests, setRequests] = useState<PrismScopeChangeRequest[]>([]);
  const [exceptions, setExceptions] = useState<PrismEventFreezeException[]>([]);
  const [addenda, setAddenda] = useState<PrismAddendum[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const next = await scopeReviewRepository.load(eventId);
      setRequests(next.requests);
      setExceptions(next.exceptions);
      setAddenda(next.addenda);
      setStatus("ready");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to load scope change requests.");
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => { void reload(); }, [reload]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The decision could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return {
    status,
    error,
    busy,
    requests,
    addenda,
    approvedExceptions: unusedApprovedExceptions(exceptions),
    reload,
    startReview: (requestId: string) => run(() => reviewScopeChangeUseCase(eventId, requestId, { decision: "start_review" }, { frozen: options.frozen })),
    reject: (requestId: string, decisionReason: string, clientResponse?: string) => run(() => reviewScopeChangeUseCase(eventId, requestId, { decision: "reject", decisionReason, clientResponse }, { frozen: options.frozen })),
    approve: (requestId: string, draft: ApprovalDraft) => {
      // The impact review is a deliberate confirmation; the server schema rejects an approval without it.
      if (!draft.impactReviewConfirmed) {
        setError("Confirm the billing, supplier, coordinator, and floorplan impact review before approving.");
        return Promise.resolve(false);
      }
      return run(() => reviewScopeChangeUseCase(eventId, requestId, {
        decision: "approve",
        impacts: draft.impacts,
        impactReviewAcknowledged: true,
        freezeExceptionId: draft.freezeExceptionId || undefined,
        addendumId: draft.addendumId || undefined,
        clientResponse: draft.clientResponse || undefined,
      }, { frozen: options.frozen }));
    },
  };
}
