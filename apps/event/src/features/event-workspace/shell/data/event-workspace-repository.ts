import {
  prismApi,
  type PrismApprovalRequest,
  type PrismDefenseReadiness,
  type PrismEventDayStatusFeed,
  type PrismLiveOps,
  type PrismPmcmEventWorkspace,
} from "@/lib/prism-api";

type TimedCache<T> = { value: T; loadedAt: number };
export type EventCommandData = {
  liveOps: PrismLiveOps;
  statusFeed: PrismEventDayStatusFeed;
  defenseReadiness: PrismDefenseReadiness;
};

const EVENT_WORKSPACE_CACHE_MS = 20_000;
const APPROVAL_CACHE_MS = 30_000;

let approvalRequestsCache: TimedCache<PrismApprovalRequest[]> | null = null;
let approvalRequestsRequest: Promise<PrismApprovalRequest[]> | null = null;
const eventCommandDataCache = new Map<string, TimedCache<EventCommandData>>();
const eventCommandDataRequests = new Map<string, Promise<EventCommandData>>();

function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

export const eventWorkspaceRepository = {
  loadWorkspace(eventId: string): Promise<PrismPmcmEventWorkspace> {
    return prismApi.pmcmEventWorkspace(eventId);
  },

  loadLiveOps(eventId: string): Promise<PrismLiveOps> {
    return prismApi.liveOps(eventId);
  },

  loadStatusFeed(eventId: string): Promise<PrismEventDayStatusFeed> {
    return prismApi.eventDayStatusFeed(eventId);
  },

  loadDefenseReadiness(eventId: string): Promise<PrismDefenseReadiness> {
    return prismApi.defenseReadiness(eventId);
  },

  getCachedApprovalRequests() {
    return approvalRequestsCache;
  },

  loadApprovalRequests(force = false): Promise<PrismApprovalRequest[]> {
    if (!force && approvalRequestsCache && isFresh(approvalRequestsCache.loadedAt, APPROVAL_CACHE_MS)) {
      return Promise.resolve(approvalRequestsCache.value);
    }
    if (!force && approvalRequestsRequest) return approvalRequestsRequest;

    approvalRequestsRequest = prismApi
      .approvalRequests()
      .then((next) => {
        approvalRequestsCache = { value: next, loadedAt: Date.now() };
        return next;
      })
      .finally(() => {
        approvalRequestsRequest = null;
      });

    return approvalRequestsRequest;
  },

  getCachedEventCommandData(eventId: string) {
    return eventCommandDataCache.get(eventId);
  },

  loadEventCommandData(eventId: string, force = false): Promise<EventCommandData> {
    const cached = eventCommandDataCache.get(eventId);
    if (!force && cached && isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) {
      return Promise.resolve(cached.value);
    }

    const existing = eventCommandDataRequests.get(eventId);
    if (!force && existing) return existing;

    const request = Promise.all([
      prismApi.liveOps(eventId),
      prismApi.eventDayStatusFeed(eventId),
      prismApi.defenseReadiness(eventId),
    ])
      .then(([liveOps, statusFeed, defenseReadiness]) => {
        const next = { liveOps, statusFeed, defenseReadiness };
        eventCommandDataCache.set(eventId, { value: next, loadedAt: Date.now() });
        return next;
      })
      .finally(() => {
        eventCommandDataRequests.delete(eventId);
      });

    eventCommandDataRequests.set(eventId, request);
    return request;
  },
};
