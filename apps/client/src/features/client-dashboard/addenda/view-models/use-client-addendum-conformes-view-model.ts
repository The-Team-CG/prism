"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrismClientAddendumConforme } from "@prism/types";
import { clientAddendumConformeRepository } from "../data/client-addendum-conforme-repository";
import { acknowledgeAddendumConformeUseCase } from "../use-cases/acknowledge-addendum-conforme";

export function useClientAddendumConformesViewModel(eventId: string) {
  const [conformes, setConformes] = useState<PrismClientAddendumConforme[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus("loading");
    setError(null);
    try {
      const next = await clientAddendumConformeRepository.list(eventId);
      if (requestVersion.current !== version) return;
      setConformes(next);
      setStatus("ready");
    } catch (cause) {
      if (requestVersion.current !== version) return;
      setError(cause instanceof Error ? cause.message : "Unable to load addenda awaiting your acknowledgement.");
      setStatus("error");
    }
  }, [eventId]);

  useEffect(() => {
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);

  const acknowledge = useCallback(async (conforme: PrismClientAddendumConforme, consentAccepted: boolean) => {
    setBusyId(conforme.id);
    setError(null);
    try {
      const updated = await acknowledgeAddendumConformeUseCase(conforme, consentAccepted);
      setConformes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The acknowledgement could not be recorded.");
      return false;
    } finally {
      setBusyId(null);
    }
  }, []);

  return { conformes, status, error, busyId, reload, acknowledge };
}
