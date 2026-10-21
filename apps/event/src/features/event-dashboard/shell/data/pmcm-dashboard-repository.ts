import type { PrismCoordinatorWorkspace, PrismPmcmDashboardWorkspace } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { eventApi } from "@/lib/prism-api";

type TimedCache<T> = { value: T; loadedAt: number };

const EVENT_DASHBOARD_CACHE_MS = 30_000;

let pmcmStateCache: TimedCache<PrismPmcmDashboardWorkspace> | null = null;
let pmcmStateRequest: Promise<PrismPmcmDashboardWorkspace> | null = null;
const coordinatorWorkspaceCache = new Map<string, TimedCache<PrismCoordinatorWorkspace>>();
const coordinatorWorkspaceRequests = new Map<string, Promise<PrismCoordinatorWorkspace>>();

function isFresh(loadedAt: number, ttl = EVENT_DASHBOARD_CACHE_MS) {
  return Date.now() - loadedAt < ttl;
}

function sessionCacheKey(session: Pick<EventSession, "email" | "role">) {
  return `${session.role}:${session.email.trim().toLowerCase()}`;
}

export const pmcmDashboardRepository = {
  isFresh,

  getCachedPmcmState() {
    return pmcmStateCache;
  },

  loadPmcmState(force = false): Promise<PrismPmcmDashboardWorkspace> {
    if (!force && pmcmStateCache && isFresh(pmcmStateCache.loadedAt)) {
      return Promise.resolve(pmcmStateCache.value);
    }
    if (!force && pmcmStateRequest) return pmcmStateRequest;

    pmcmStateRequest = eventApi.pmcmDashboard
      .detail()
      .then((next) => {
        pmcmStateCache = { value: next, loadedAt: Date.now() };
        return next;
      })
      .finally(() => {
        pmcmStateRequest = null;
      });

    return pmcmStateRequest;
  },

  getCachedCoordinatorWorkspace(session: EventSession) {
    return coordinatorWorkspaceCache.get(sessionCacheKey(session));
  },

  loadCoordinatorWorkspace(session: EventSession, force = false): Promise<PrismCoordinatorWorkspace> {
    const key = sessionCacheKey(session);
    const cached = coordinatorWorkspaceCache.get(key);
    if (!force && cached && isFresh(cached.loadedAt)) return Promise.resolve(cached.value);

    const existing = coordinatorWorkspaceRequests.get(key);
    if (!force && existing) return existing;

    const request = eventApi.coordinator
      .workspace()
      .then((next) => {
        coordinatorWorkspaceCache.set(key, { value: next, loadedAt: Date.now() });
        return next;
      })
      .finally(() => {
        coordinatorWorkspaceRequests.delete(key);
      });

    coordinatorWorkspaceRequests.set(key, request);
    return request;
  },
};
