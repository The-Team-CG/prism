import { createEventOpsClient } from "@prism/api-client";
import type { PrismCoordinatorWorkspace } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { eventApi, storedEventAccessToken } from "@/lib/prism-api";

type TimedCache<T> = { value: T; loadedAt: number };

const WORKSPACE_CACHE_MS = 30_000;
const workspaceCache = new Map<string, TimedCache<PrismCoordinatorWorkspace>>();
const workspaceRequests = new Map<string, Promise<PrismCoordinatorWorkspace>>();

/**
 * Carries the stored token without the portal's session-expiry handler: signing out with an expired token must not
 * redirect to sign-in with next=.
 */
const logoutClient = createEventOpsClient({ getAuthToken: storedEventAccessToken });

const cacheKey = (session: Pick<EventSession, "email" | "role">) => `${session.role}:${session.email.trim().toLowerCase()}`;

/** The coordinator's assigned events and roles: the one read the coordinator portal starts from. */
export const coordinatorWorkspaceRepository = {
  cached(session: EventSession): TimedCache<PrismCoordinatorWorkspace> | undefined {
    return workspaceCache.get(cacheKey(session));
  },
  isFresh(loadedAt: number) {
    return Date.now() - loadedAt < WORKSPACE_CACHE_MS;
  },
  load(session: EventSession, force = false): Promise<PrismCoordinatorWorkspace> {
    const key = cacheKey(session);
    const cached = workspaceCache.get(key);
    if (!force && cached && this.isFresh(cached.loadedAt)) return Promise.resolve(cached.value);
    const existing = workspaceRequests.get(key);
    if (!force && existing) return existing;
    const request = eventApi.coordinator
      .workspace()
      .then((next) => {
        workspaceCache.set(key, { value: next, loadedAt: Date.now() });
        return next;
      })
      .finally(() => workspaceRequests.delete(key));
    workspaceRequests.set(key, request);
    return request;
  },
  logout() {
    return logoutClient.auth.logout();
  },
};
