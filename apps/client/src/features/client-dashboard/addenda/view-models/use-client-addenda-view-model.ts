"use client";

import { useEffect, useState } from "react";
import type { PrismAddendum } from "@prism/types";
import { clientAddendaRepository } from "../data/client-addenda-repository";
import { acknowledgeAddendumConformeUseCase } from "../use-cases/acknowledge-addendum-conforme";

export function useClientAddendaViewModel(eventId: string) {
  const [addenda, setAddenda] = useState<PrismAddendum[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [consentByAddendum, setConsentByAddendum] = useState<Record<string, boolean>>({});
  const [signingAddendumId, setSigningAddendumId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    clientAddendaRepository.list(eventId)
      .then((next) => {
        if (!active) return;
        setAddenda(next);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load addenda.");
        setStatus("error");
      });
    return () => { active = false; };
  }, [eventId]);

  async function acknowledge(addendum: PrismAddendum) {
    if (signingAddendumId) return;
    setSigningAddendumId(addendum.id);
    setError(null);
    try {
      const updated = await acknowledgeAddendumConformeUseCase(eventId, addendum);
      setAddenda((current) => current.map((item) => (item.id === addendum.id ? { ...item, conforme: updated } : item)));
      setConsentByAddendum((current) => ({ ...current, [addendum.id]: false }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record your acknowledgment.");
    } finally {
      setSigningAddendumId(null);
    }
  }

  return {
    addenda,
    status,
    error,
    signingAddendumId,
    consentAccepted: (addendumId: string) => consentByAddendum[addendumId] === true,
    setConsentAccepted: (addendumId: string, accepted: boolean) => setConsentByAddendum((current) => ({ ...current, [addendumId]: accepted })),
    acknowledge,
  };
}
