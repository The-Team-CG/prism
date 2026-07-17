import {
  type PrismPmcmCommandInbox,
} from "@/lib/prism-api";
import { eventOpsRepository } from "@/features/event-ops";

type TimedCache<T> = { value: T; loadedAt: number };

const COMMAND_INBOX_CACHE_MS = 30_000;

let commandInboxCache: TimedCache<PrismPmcmCommandInbox> | null = null;
let commandInboxRequest: Promise<PrismPmcmCommandInbox> | null = null;

function isFresh(loadedAt: number, ttl = COMMAND_INBOX_CACHE_MS) {
  return Date.now() - loadedAt < ttl;
}

export const commandInboxRepository = {
  getCached(): TimedCache<PrismPmcmCommandInbox> | null {
    return commandInboxCache;
  },

  load(force = false): Promise<PrismPmcmCommandInbox> {
    if (!force && commandInboxCache && isFresh(commandInboxCache.loadedAt)) {
      return Promise.resolve(commandInboxCache.value);
    }
    if (!force && commandInboxRequest) return commandInboxRequest;

    commandInboxRequest = eventOpsRepository
      .pmcmCommandInbox()
      .then((next) => {
        commandInboxCache = { value: next, loadedAt: Date.now() };
        return next;
      })
      .finally(() => {
        commandInboxRequest = null;
      });

    return commandInboxRequest;
  },

  clearCache() {
    commandInboxCache = null;
    commandInboxRequest = null;
  },
};
