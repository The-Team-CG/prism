"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrismApprovedClientAccount, PrismEventClientAccess } from "@prism/types";
import { clientFloorplanAccessRepository } from "../data/client-floorplan-access-repository";
import { availableClientCandidates } from "../model/client-floorplan-access";

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useClientFloorplanAccessViewModel(eventId: string) {
  const [access, setAccess] = useState<PrismEventClientAccess | null>(null);
  const [candidates, setCandidates] = useState<PrismApprovedClientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentEventId = useRef(eventId);
  currentEventId.current = eventId;

  const applyAccess = useCallback((next: PrismEventClientAccess) => {
    if (currentEventId.current !== eventId || next.eventId !== eventId) return;
    setAccess(next);
    setCandidates((current) => availableClientCandidates(next, current));
  }, [eventId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await clientFloorplanAccessRepository.listAccess(eventId);
      applyAccess(next);
    } catch (cause) {
      if (currentEventId.current === eventId) {
        setError(errorMessage(cause, "Unable to load floorplan access."));
      }
    } finally {
      if (currentEventId.current === eventId) setLoading(false);
    }
  }, [applyAccess, eventId]);

  useEffect(() => {
    setAccess(null);
    setCandidates([]);
    void reload();
  }, [reload]);

  const search = useCallback(async (query: string) => {
    if (access?.eventId !== eventId || !query.trim()) {
      setCandidates([]);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const results = await clientFloorplanAccessRepository.searchCandidates(eventId, query.trim());
      if (currentEventId.current === eventId) {
        setCandidates(availableClientCandidates(access, results));
      }
    } catch (cause) {
      if (currentEventId.current === eventId) {
        setError(errorMessage(cause, "Unable to search approved Client accounts."));
      }
    } finally {
      if (currentEventId.current === eventId) setSearching(false);
    }
  }, [access, eventId]);

  const grant = useCallback(async (userId: string) => {
    if (access?.eventId !== eventId || busyUserId) return;
    if (!candidates.some((candidate) => candidate.id === userId)) return;
    setBusyUserId(userId);
    setError(null);
    try {
      applyAccess(await clientFloorplanAccessRepository.grant(eventId, userId));
    } catch (cause) {
      if (currentEventId.current === eventId) {
        setError(errorMessage(cause, "Unable to grant floorplan access."));
      }
    } finally {
      if (currentEventId.current === eventId) setBusyUserId(null);
    }
  }, [access, applyAccess, busyUserId, candidates, eventId]);

  const revoke = useCallback(async (userId: string) => {
    if (access?.eventId !== eventId || busyUserId) return;
    if (!access.secondaryContacts.some((contact) => contact.id === userId)) return;
    setBusyUserId(userId);
    setError(null);
    try {
      applyAccess(await clientFloorplanAccessRepository.revoke(eventId, userId));
    } catch (cause) {
      if (currentEventId.current === eventId) {
        setError(errorMessage(cause, "Unable to revoke floorplan access."));
      }
    } finally {
      if (currentEventId.current === eventId) setBusyUserId(null);
    }
  }, [access, applyAccess, busyUserId, eventId]);

  return {
    access: access?.eventId === eventId ? access : null,
    candidates: access?.eventId === eventId ? candidates : [],
    loading,
    searching,
    busyUserId,
    error,
    reload,
    search,
    grant,
    revoke,
  };
}
