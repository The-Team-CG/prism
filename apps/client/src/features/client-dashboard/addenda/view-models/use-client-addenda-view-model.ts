"use client";

import { useState } from "react";
import type { PrismAddendum } from "@prism/types";
import { useInvalidate, useResource } from "@prism/portal-query";
import { clientEventAddendaResource } from "../data/client-addenda-repository";
import { acknowledgeAddendumConformeUseCase } from "../use-cases/acknowledge-addendum-conforme";

/** `onChanged` refreshes what else shows the addendum, such as the client's action list. */
export function useClientAddendaViewModel(eventId: string, onChanged?: () => unknown) {
  const list = useResource(clientEventAddendaResource, eventId);
  const invalidate = useInvalidate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [consentByAddendum, setConsentByAddendum] = useState<Record<string, boolean>>({});
  const [signingAddendumId, setSigningAddendumId] = useState<string | null>(null);

  /** Resolves true once the signature is recorded, so the caller can close what it opened. */
  async function acknowledge(addendum: PrismAddendum): Promise<boolean> {
    if (signingAddendumId) return false;
    setSigningAddendumId(addendum.id);
    setActionError(null);
    try {
      await acknowledgeAddendumConformeUseCase(eventId, addendum);
      setConsentByAddendum((current) => ({ ...current, [addendum.id]: false }));
      await invalidate(clientEventAddendaResource, eventId);
      void onChanged?.();
      return true;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to record your acknowledgment.");
      return false;
    } finally {
      setSigningAddendumId(null);
    }
  }

  return {
    addenda: list.data ?? [],
    status: list.status === "pending" ? ("loading" as const) : list.status,
    error: actionError ?? (list.status === "error" ? list.error.message || "Unable to load addenda." : null),
    signingAddendumId,
    consentAccepted: (addendumId: string) => consentByAddendum[addendumId] === true,
    setConsentAccepted: (addendumId: string, accepted: boolean) => setConsentByAddendum((current) => ({ ...current, [addendumId]: accepted })),
    acknowledge,
  };
}
