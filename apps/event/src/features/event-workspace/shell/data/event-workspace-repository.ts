import type { PrismApprovalRequest, PrismDefenseReadiness, PrismEventDayStatusFeed, PrismGuestPrivacyClassification, PrismLiveOps, PrismPmcmEventWorkspace, PrismRegistrationPlatform } from "@prism/types";
import { eventApi, eventApiRequest } from "@/lib/prism-api";

type TimedCache<T> = { value: T; loadedAt: number };
export type EventCommandData = {
  liveOps: PrismLiveOps | null;
  statusFeed: PrismEventDayStatusFeed | null;
  defenseReadiness: PrismDefenseReadiness | null;
  registrationPlatform: PrismRegistrationPlatform | null;
  guestPrivacyClassification: PrismGuestPrivacyClassification | null;
};

/**
 * Event command data comes in parts, each fetched only by the screens that render it:
 * readiness (overview, home, tasks), live ops (live desk) and registration (registration and games).
 */
export type EventCommandPart = "readiness" | "liveOps" | "registration";

const EMPTY_COMMAND_DATA: EventCommandData = {
  liveOps: null, statusFeed: null, defenseReadiness: null, registrationPlatform: null, guestPrivacyClassification: null,
};

export type EventCommandDataErrors = {
  liveOps?: string;
  statusFeed?: string;
  defenseReadiness?: string;
  registrationPlatform?: string;
  guestPrivacyClassification?: string;
};

const EVENT_WORKSPACE_CACHE_MS = 20_000;
const APPROVAL_CACHE_MS = 30_000;

let approvalRequestsCache: TimedCache<PrismApprovalRequest[]> | null = null;
let approvalRequestsRequest: Promise<PrismApprovalRequest[]> | null = null;
type PartResult = { data: Partial<EventCommandData>; errors: EventCommandDataErrors };
const eventCommandPartCache = new Map<string, TimedCache<Partial<EventCommandData>>>();
const eventCommandPartRequests = new Map<string, Promise<PartResult>>();
const partKey = (eventId: string, part: EventCommandPart) => `${eventId}:${part}`;

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

  /** Every cached part for the event, and when the oldest requested part was loaded (0 if one is missing). */
  getCachedEventCommandData(eventId: string, parts: readonly EventCommandPart[]): TimedCache<EventCommandData> | undefined {
    const all: EventCommandPart[] = ["readiness", "liveOps", "registration"];
    const cachedParts = all.map((part) => eventCommandPartCache.get(partKey(eventId, part))).filter((entry) => entry !== undefined);
    if (cachedParts.length === 0) return undefined;
    const value = Object.assign({}, EMPTY_COMMAND_DATA, ...cachedParts.map((entry) => entry.value));
    const loadedAt = Math.min(...parts.map((part) => eventCommandPartCache.get(partKey(eventId, part))?.loadedAt ?? 0));
    return { value, loadedAt };
  },

  async loadEventCommandData(
    eventId: string,
    parts: readonly EventCommandPart[],
    force = false,
  ): Promise<{ data: EventCommandData; errors: EventCommandDataErrors }> {
    const results = await Promise.all(parts.map((part) => loadPart(eventId, part, force)));
    const cached = this.getCachedEventCommandData(eventId, parts)?.value ?? EMPTY_COMMAND_DATA;
    return {
      data: Object.assign({}, cached, ...results.map((result) => result.data)),
      errors: Object.assign({}, ...results.map((result) => result.errors)),
    };
  },
};

function settle<T>(errors: EventCommandDataErrors, label: keyof EventCommandDataErrors, promise: Promise<T>) {
  return promise.catch((err: unknown) => {
    errors[label] = err instanceof Error ? err.message : String(err);
    return null;
  });
}

async function fetchPart(eventId: string, part: EventCommandPart): Promise<PartResult> {
  const errors: EventCommandDataErrors = {};
  if (part === "readiness") {
    const defenseReadiness = await settle(errors, "defenseReadiness", eventApiRequest<PrismDefenseReadiness>(`/api/events/${eventId}/defense-readiness`));
    return { data: { defenseReadiness }, errors };
  }
  if (part === "liveOps") {
    const [liveOps, statusFeed] = await Promise.all([
      settle(errors, "liveOps", eventApi.liveOps.eventDayWorkspace(eventId)),
      settle(errors, "statusFeed", eventApiRequest<PrismEventDayStatusFeed>(`/api/events/${eventId}/event-day/status-feed`)),
    ]);
    return { data: { liveOps, statusFeed }, errors };
  }
  const [registrationPlatform, guestPrivacyClassification] = await Promise.all([
    settle(errors, "registrationPlatform", eventApi.pmcm.registrationPlatform(eventId)),
    settle(errors, "guestPrivacyClassification", eventApi.guest.guestPrivacyClassification(eventId)),
  ]);
  return { data: { registrationPlatform, guestPrivacyClassification }, errors };
}

/** One in-flight request per event part, shared by every caller; a fresh cached part is reused unless forced. */
async function loadPart(eventId: string, part: EventCommandPart, force: boolean): Promise<PartResult> {
  const key = partKey(eventId, part);
  const cached = eventCommandPartCache.get(key);
  if (!force && cached && isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) return { data: cached.value, errors: {} };
  const existing = eventCommandPartRequests.get(key);
  if (existing) return existing;
  const request = fetchPart(eventId, part).then((result) => {
    if (Object.keys(result.errors).length === 0) eventCommandPartCache.set(key, { value: result.data, loadedAt: Date.now() });
    return result;
  });
  eventCommandPartRequests.set(key, request);
  try {
    return await request;
  } finally {
    eventCommandPartRequests.delete(key);
  }
}
