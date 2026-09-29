import type { PrismPmcmCommandInbox } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

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
      .commandInbox({ page })
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
