"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import { prismApi, type PrismSampleState, type PrismUser } from "@/lib/prism-api";
import { dashboardHref } from "./client-dashboard.navigation";
import type { ClientDashboardRoute, ClientPortalView } from "./client-dashboard.types";

export type ClientSession = PrismUser & { signedInAt: string };

const CLIENT_STATE_CACHE_MS = 30_000;
const clientStateCache = new Map<string, { state: PrismSampleState; loadedAt: number }>();
const clientStateRequests = new Map<string, Promise<PrismSampleState>>();

function clientStateCacheKey(session: Pick<PrismUser, "email">) {
  return session.email.trim().toLowerCase();
}

function getCachedClientState(session: Pick<PrismUser, "email">) {
  return clientStateCache.get(clientStateCacheKey(session));
}

function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

function readSession(): ClientSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MOCK_AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientSession;
  } catch {
    window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
    return null;
  }
}

async function loadClientState(session: Pick<PrismUser, "email" | "name">, force = false) {
  const key = clientStateCacheKey(session);

  if (!force) {
    const cached = clientStateCache.get(key);
    if (cached && isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS)) return cached.state;

    const existing = clientStateRequests.get(key);
    if (existing) return existing;
  }

  const request = prismApi
    .clientState(session)
    .then((next) => {
      clientStateCache.set(key, { state: next, loadedAt: Date.now() });
      return next;
    })
    .finally(() => clientStateRequests.delete(key));

  clientStateRequests.set(key, request);
  return request;
}

export function useClientDashboardState({
  route,
  eventId,
  portalView,
}: {
  route: ClientDashboardRoute;
  eventId?: string;
  portalView?: ClientPortalView;
}) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [state, setState] = useState<PrismSampleState | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const current = readSession();
    if (!current) {
      router.replace(`/sign-in?next=${encodeURIComponent(dashboardHref(route, eventId, portalView))}`);
      return;
    }
    setSession(current);
    if (current.role !== "client") return;

    const applyState = (next: PrismSampleState) => {
      if (cancelled) return;
      setState(next);
      setError(null);
      const firstClientEvent = next.events.find(
        (event) => event.clientName === current.name && event.clientPortalStatus === "unlocked",
      );
      setSelectedEventId(eventId ?? firstClientEvent?.id ?? null);
    };

    const cached = getCachedClientState(current);
    if (cached) {
      applyState(cached.state);
      if (isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    loadClientState(current, !cached)
      .then(applyState)
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load client portal");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, portalView, route, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const next = await loadClientState(session, true);
    setState(next);
  }, [session]);

  return {
    error,
    refresh,
    selectedEventId,
    session,
    setError,
    setSelectedEventId,
    state,
  };
}
