"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismClientSharedFloorplanEntry } from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import { clientSharedFloorplansRepository } from "../data/client-shared-floorplans-repository";
import {
  listClientSharedFloorplans,
  loadClientSharedFloorplanSnapshot,
} from "../use-cases/load-client-shared-floorplans";
import { isClientFloorplanSnapshotType } from "../model/client-shared-floorplans";

const SHARED_FLOORPLANS_ROUTE = "/dashboard/shared-floorplans";

function messageForSnapshotError(cause: unknown): string {
  if (cause && typeof cause === "object" && "status" in cause && cause.status === 403) {
    return "This floorplan is no longer shared with your account.";
  }
  return cause instanceof Error ? cause.message : "Unable to load this shared floorplan.";
}

export function useClientSharedFloorplansViewModel() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof clientSharedFloorplansRepository.readSession>>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [entries, setEntries] = useState<PrismClientSharedFloorplanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const current = clientSharedFloorplansRepository.readSession();
    setSession(current);
    setSessionReady(true);
    if (!current) {
      router.replace(`/sign-in?next=${encodeURIComponent(SHARED_FLOORPLANS_ROUTE)}`);
    }
  }, [router]);

  useEffect(() => {
    if (!sessionReady || !session) return;
    if (session.role !== "client") {
      setLoading(false);
      setError("This view is available to Client accounts only.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void listClientSharedFloorplans()
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load shared floorplans.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadVersion, router, session, sessionReady]);

  const reload = useCallback(() => {
    if (session?.role === "client") setReloadVersion((value) => value + 1);
  }, [session]);

  return { session, entries, loading, error, reload };
}

export function useClientSharedFloorplanSnapshotViewModel(
  eventId: string,
  draftId: string,
  snapshotTypeValue: string,
) {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof clientSharedFloorplansRepository.readSession>>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [entry, setEntry] = useState<PrismClientSharedFloorplanEntry | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestKey = JSON.stringify([eventId, draftId, snapshotTypeValue]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const current = clientSharedFloorplansRepository.readSession();
    setSession(current);
    setSessionReady(true);
    if (!current) {
      const next = `${SHARED_FLOORPLANS_ROUTE}/${encodeURIComponent(eventId)}/${encodeURIComponent(draftId)}/${encodeURIComponent(snapshotTypeValue)}`;
      router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }, [draftId, eventId, router, snapshotTypeValue]);

  useEffect(() => {
    if (!sessionReady || !session) return;
    let cancelled = false;
    setEntry(null);
    setProject(null);
    setLoadedKey(null);
    setError(null);
    setErrorKey(null);
    setLoading(true);
    setLoadingKey(requestKey);

    if (session.role !== "client") {
      setLoading(false);
      setError("This view is available to Client accounts only.");
      setErrorKey(requestKey);
      return () => { cancelled = true; };
    }
    if (!isClientFloorplanSnapshotType(snapshotTypeValue)) {
      setLoading(false);
      setError("This snapshot type is not available.");
      setErrorKey(requestKey);
      return () => { cancelled = true; };
    }

    void loadClientSharedFloorplanSnapshot(eventId, draftId, snapshotTypeValue)
      .then((result) => {
        if (cancelled) return;
        setEntry(result.entry);
        setProject(result.project);
        setLoadedKey(requestKey);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setProject(null);
          setError(messageForSnapshotError(cause));
          setErrorKey(requestKey);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, eventId, session, sessionReady, snapshotTypeValue]);

  return {
    session,
    entry: loadedKey === requestKey ? entry : null,
    project: loadedKey === requestKey ? project : null,
    loading: loadingKey !== requestKey || loading,
    error: errorKey === requestKey ? error : null,
  };
}
