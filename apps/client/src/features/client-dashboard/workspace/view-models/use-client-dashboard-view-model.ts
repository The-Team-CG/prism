"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismClientActionCenter, PrismClientWorkspace, PrismUser } from "@prism/types";
import { dashboardHref } from "../model/client-dashboard-navigation";
import type { ClientDashboardRoute, ClientPortalView, ClientSession } from "../model/client-dashboard-types";
import {
  loadClientActionCenter,
  loadClientWorkspace,
  readClientSession,
} from "../use-cases/client-dashboard-actions";

export type { ClientSession };
export type ClientDashboardStatus = "idle" | "loading" | "success" | "error";

const CLIENT_STATE_CACHE_MS = 30_000;
const clientStateCache = new Map<string, { state: PrismClientWorkspace; loadedAt: number }>();
const clientStateRequests = new Map<string, Promise<PrismClientWorkspace>>();
const clientActionCenterCache = new Map<string, { actionCenter: PrismClientActionCenter; loadedAt: number }>();
const clientActionCenterRequests = new Map<string, Promise<PrismClientActionCenter>>();

function clientStateCacheKey(session: Pick<PrismUser, "email">) {
  return session.email.trim().toLowerCase();
}

function getCachedClientState(session: Pick<PrismUser, "email">) {
  return clientStateCache.get(clientStateCacheKey(session));
}

function getCachedClientActionCenter(session: Pick<PrismUser, "email">) {
  return clientActionCenterCache.get(clientStateCacheKey(session));
}

function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

async function loadClientState(session: Pick<PrismUser, "email" | "name">, force = false) {
  const key = clientStateCacheKey(session);

  if (!force) {
    const cached = clientStateCache.get(key);
    if (cached && isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS)) return cached.state;

    const existing = clientStateRequests.get(key);
    if (existing) return existing;
  }

  const request = loadClientWorkspace()
    .then((next) => {
      clientStateCache.set(key, { state: next, loadedAt: Date.now() });
      return next;
    })
    .finally(() => clientStateRequests.delete(key));

  clientStateRequests.set(key, request);
  return request;
}

async function loadActionCenterCached(session: Pick<PrismUser, "email" | "name">, force = false) {
  const key = clientStateCacheKey(session);

  if (!force) {
    const cached = clientActionCenterCache.get(key);
    if (cached && isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS)) return cached.actionCenter;

    const existing = clientActionCenterRequests.get(key);
    if (existing) return existing;
  }

  const request = loadClientActionCenter()
    .then((next) => {
      clientActionCenterCache.set(key, { actionCenter: next, loadedAt: Date.now() });
      return next;
    })
    .finally(() => clientActionCenterRequests.delete(key));

  clientActionCenterRequests.set(key, request);
  return request;
}

export function useClientDashboardViewModel({
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
  const [actionCenter, setActionCenter] = useState<PrismClientActionCenter | null>(null);
  const [actionCenterLoadFailed, setActionCenterLoadFailed] = useState(false);
  const [state, setState] = useState<PrismClientWorkspace | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const current = readClientSession();
    if (!current) {
      setActionCenter(null);
      setState(null);
      router.replace(`/sign-in?next=${encodeURIComponent(dashboardHref(route, eventId, portalView))}`);
      return;
    }
    setSession(current);
    if (current.role !== "client") {
      setActionCenter(null);
      return;
    }

    const applyState = (next: PrismClientWorkspace) => {
      if (cancelled) return;
      setState(next);
      setError(null);
      const firstClientEvent = next.events.find(
        (event) => event.clientName === current.name && event.clientPortalStatus === "unlocked",
      );
      setSelectedEventId(eventId ?? firstClientEvent?.id ?? null);
    };

    const applyActionCenter = (next: PrismClientActionCenter) => {
      if (cancelled) return;
      setActionCenter(next);
      setActionCenterLoadFailed(false);
    };

    const cached = getCachedClientState(current);
    if (cached) {
      applyState(cached.state);
    }
    const cachedActionCenter = getCachedClientActionCenter(current);
    if (cachedActionCenter) applyActionCenter(cachedActionCenter.actionCenter);

    const stateIsFresh = Boolean(cached && isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS));
    const actionCenterIsFresh = Boolean(cachedActionCenter && isFresh(cachedActionCenter.loadedAt, CLIENT_STATE_CACHE_MS));

    if (!stateIsFresh) loadClientState(current, !cached)
      .then(applyState)
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load client portal");
      });

    if (!actionCenterIsFresh) loadActionCenterCached(current, !cachedActionCenter)
      .then(applyActionCenter)
      .catch(() => {
        if (!cancelled) {
          setActionCenter(null);
          setActionCenterLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, portalView, route, router]);

  const status: ClientDashboardStatus = error ? "error" : state ? "success" : session ? "loading" : "idle";

  const refresh = useCallback(async () => {
    if (!session) return;
    const [next, nextActionCenter] = await Promise.all([
      loadClientState(session, true),
      loadActionCenterCached(session, true).catch(() => null),
    ]);
    setState(next);
    setActionCenter(nextActionCenter);
    setActionCenterLoadFailed(!nextActionCenter);
  }, [session]);

  return {
    actionCenter,
    actionCenterLoadFailed,
    error,
    status,
    refresh,
    selectedEventId,
    session,
    setError,
    setSelectedEventId,
    state,
  };
}
