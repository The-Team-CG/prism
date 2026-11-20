import { PRISM_PMCM_COMMAND_INBOX_MAX_PAGE_SIZE, type PrismPmcmCommandInbox } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";
import { inboxLiveCounts } from "../model/inbox-today";

type TimedCache<T> = { value: T; loadedAt: number };

const COMMAND_INBOX_CACHE_MS = 30_000;

const commandInboxCache = new Map<number, TimedCache<PrismPmcmCommandInbox>>();
const commandInboxRequests = new Map<number, Promise<PrismPmcmCommandInbox>>();

function isFresh(loadedAt: number, ttl = COMMAND_INBOX_CACHE_MS) {
  return Date.now() - loadedAt < ttl;
}

export const commandInboxRepository = {
  getCached(page = 0): TimedCache<PrismPmcmCommandInbox> | null {
    return commandInboxCache.get(page) ?? null;
  },

  load(force = false, page = 0): Promise<PrismPmcmCommandInbox> {
    const cached = commandInboxCache.get(page);
    if (!force && cached && isFresh(cached.loadedAt)) {
      return Promise.resolve(cached.value);
    }
    const existing = commandInboxRequests.get(page);
    if (!force && existing) return existing;

    const request = eventApi.pmcm
      // The largest page the API allows, so the Inbox rarely needs paging.
      .commandInbox({ page, pageSize: PRISM_PMCM_COMMAND_INBOX_MAX_PAGE_SIZE })
      .then((next) => {
        commandInboxCache.set(page, { value: next, loadedAt: Date.now() });
        return next;
      })
      .finally(() => {
        commandInboxRequests.delete(page);
      });

    commandInboxRequests.set(page, request);
    return request;
  },

  clearCache() {
    commandInboxCache.clear();
    commandInboxRequests.clear();
  },
};

/** Guests in and open issues for the event on today, for the Inbox's lead. Refreshes while the Inbox is open. */
export const inboxLiveEvent = defineResource({
  name: "command-inbox.live-event",
  staleMs: 20_000,
  pollMs: 30_000,
  fetch: (eventId: string) => eventApi.liveOps.eventDayWorkspace(eventId).then(inboxLiveCounts),
});
