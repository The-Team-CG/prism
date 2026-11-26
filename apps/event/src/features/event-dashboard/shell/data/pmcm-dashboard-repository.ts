import type { PrismPmcmReference } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { eventApi } from "@/lib/prism-api";

type TimedCache<T> = { value: T; loadedAt: number };

const EVENT_DASHBOARD_CACHE_MS = 30_000;

let pmcmReferenceCache: TimedCache<PrismPmcmReference> | null = null;
let pmcmReferenceRequest: Promise<PrismPmcmReference> | null = null;

function isFresh(loadedAt: number, ttl = EVENT_DASHBOARD_CACHE_MS) {
  return Date.now() - loadedAt < ttl;
}

function sessionCacheKey(session: Pick<EventSession, "email" | "role">) {
  return `${session.role}:${session.email.trim().toLowerCase()}`;
}

export const pmcmDashboardRepository = {
  isFresh,

  getCachedPmcmReference() {
    return pmcmReferenceCache;
  },

  /** Drops the cached events, so the next page that needs them reads afresh (after a change such as a new cover). */
  forgetPmcmReference() {
    pmcmReferenceCache = null;
  },

  /** The event switcher, inquiries, directories and rules event pages need, without the whole-system dashboard. */
  loadPmcmReference(force = false): Promise<PrismPmcmReference> {
    if (!force && pmcmReferenceCache && isFresh(pmcmReferenceCache.loadedAt)) {
      return Promise.resolve(pmcmReferenceCache.value);
    }
    if (!force && pmcmReferenceRequest) return pmcmReferenceRequest;

    pmcmReferenceRequest = eventApi.pmcm
      .reference()
      .then((next) => {
        pmcmReferenceCache = { value: next, loadedAt: Date.now() };
        return next;
      })
      .finally(() => {
        pmcmReferenceRequest = null;
      });

    return pmcmReferenceRequest;
  },


};
