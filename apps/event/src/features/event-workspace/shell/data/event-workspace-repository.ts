import type { PrismApprovalRequest, PrismDefenseReadiness, PrismEventDayStatusFeed, PrismLiveOps, PrismPmcmEventWorkspace, PrismRegistrationPlatform } from "@prism/types";
import { eventApi, eventApiRequest } from "@/lib/prism-api";

type TimedCache<T> = { value: T; loadedAt: number };
export type EventCommandData = {
  liveOps: PrismLiveOps;
  statusFeed: PrismEventDayStatusFeed;
  defenseReadiness: PrismDefenseReadiness;
  registrationPlatform: PrismRegistrationPlatform | null;
};

export type EventCommandDataErrors = {
  liveOps?: string;
  statusFeed?: string;
  defenseReadiness?: string;
  registrationPlatform?: string;
};

const EVENT_WORKSPACE_CACHE_MS = 20_000;
const APPROVAL_CACHE_MS = 30_000;

let approvalRequestsCache: TimedCache<PrismApprovalRequest[]> | null = null;
let approvalRequestsRequest: Promise<PrismApprovalRequest[]> | null = null;
const eventCommandDataCache = new Map<string, TimedCache<EventCommandData>>();
const eventCommandDataRequests = new Map<string, Promise<{ data: EventCommandData; errors: EventCommandDataErrors }>>();

function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

export const eventWorkspaceRepository = {
  loadWorkspace(eventId: string): Promise<PrismPmcmEventWorkspace> {
    return eventApi.pmcm.eventWorkspace(eventId);
  },

  loadLiveOps(eventId: string): Promise<PrismLiveOps> {
    return eventApi.liveOps.eventDayWorkspace(eventId);
  },

  loadStatusFeed(eventId: string): Promise<PrismEventDayStatusFeed> {
    return eventApiRequest<PrismEventDayStatusFeed>(`/api/events/${eventId}/event-day/status-feed`);
  },

  loadDefenseReadiness(eventId: string): Promise<PrismDefenseReadiness> {
    return eventApiRequest<PrismDefenseReadiness>(`/api/events/${eventId}/defense-readiness`);
  },

  getCachedApprovalRequests() {
    return approvalRequestsCache;
  },

  loadApprovalRequests(force = false): Promise<PrismApprovalRequest[]> {
    if (!force && approvalRequestsCache && isFresh(approvalRequestsCache.loadedAt, APPROVAL_CACHE_MS)) {
      return Promise.resolve(approvalRequestsCache.value);
    }
    if (!force && approvalRequestsRequest) return approvalRequestsRequest;

    approvalRequestsRequest = eventApiRequest<PrismApprovalRequest[]>("/api/auth/approval-requests")
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

  async loadEventCommandData(
    eventId: string,
    force = false,
  ): Promise<{ data: EventCommandData; errors: EventCommandDataErrors }> {
    const cached = eventCommandDataCache.get(eventId);
    if (!force && cached && isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) {
      return { data: cached.value, errors: {} };
    }

    const existing = eventCommandDataRequests.get(eventId);
    if (!force && existing) {
      return await existing;
    }

    const request = (async () => {
      const errors: EventCommandDataErrors = {};
      const settle = <T>(label: keyof EventCommandDataErrors, promise: Promise<T>) =>
        promise.catch((err: unknown) => {
          errors[label] = err instanceof Error ? err.message : String(err);
          return null as T;
        });

      const [liveOps, statusFeed, defenseReadiness, registrationPlatform] = await Promise.all([
        settle("liveOps", eventApi.liveOps.eventDayWorkspace(eventId)),
        settle("statusFeed", eventApiRequest<PrismEventDayStatusFeed>(`/api/events/${eventId}/event-day/status-feed`)),
        settle("defenseReadiness", eventApiRequest<PrismDefenseReadiness>(`/api/events/${eventId}/defense-readiness`)),
        settle("registrationPlatform", eventApi.pmcm.registrationPlatform(eventId)),
      ]);

      const next: EventCommandData = {
        liveOps: liveOps!,
        statusFeed: statusFeed!,
        defenseReadiness: defenseReadiness!,
        registrationPlatform,
      };
      eventCommandDataCache.set(eventId, { value: next, loadedAt: Date.now() });
      return { data: next, errors };
    })();

    eventCommandDataRequests.set(eventId, request);
    try {
      return await request;
    } finally {
      eventCommandDataRequests.delete(eventId);
    }
  },
};
