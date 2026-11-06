"use client";

import { useState } from "react";
import type { PrismAddendum } from "@prism/types";
import { useInvalidate, useResource } from "@prism/portal-query";
import { clientEventAddendaResource } from "../data/client-addenda-repository";
import { acknowledgeAddendumConformeUseCase } from "../use-cases/acknowledge-addendum-conforme";

export function useClientAddendaViewModel(eventId: string) {
  const list = useResource(clientEventAddendaResource, eventId);
  const invalidate = useInvalidate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [consentByAddendum, setConsentByAddendum] = useState<Record<string, boolean>>({});
  const [signingAddendumId, setSigningAddendumId] = useState<string | null>(null);

  async function acknowledge(addendum: PrismAddendum) {
    if (signingAddendumId) return;
    setSigningAddendumId(addendum.id);
    setActionError(null);
    try {
      await acknowledgeAddendumConformeUseCase(eventId, addendum);
      setConsentByAddendum((current) => ({ ...current, [addendum.id]: false }));
      await invalidate(clientEventAddendaResource, eventId);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to record your acknowledgment.");
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
