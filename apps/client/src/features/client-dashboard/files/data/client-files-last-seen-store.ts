import { PRISM_SESSION_STORAGE_KEYS } from "@prism/types";

type LastSeen = Record<string, string>;

const KEY = PRISM_SESSION_STORAGE_KEYS.clientFilesLastSeen;
/** Old visits stop mattering; keep the stored map small. */
const MAX_ENTRIES = 200;

function read(): LastSeen {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as LastSeen) : {};
  } catch {
    return {};
  }
}

/**
 * When this browser's signed-in client last opened an event's files. A convenience only: when storage is blocked
 * or cleared, nothing is marked new.
 */
export const clientFilesLastSeenStore = {
  get(actorId: string, eventId: string): string | null {
    const value = read()[`${actorId}:${eventId}`];
    return typeof value === "string" ? value : null;
  },

  set(actorId: string, eventId: string, seenAt: string) {
    try {
      const entries = Object.entries({ ...read(), [`${actorId}:${eventId}`]: seenAt })
        .sort(([, left], [, right]) => right.localeCompare(left))
        .slice(0, MAX_ENTRIES);
      globalThis.localStorage?.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Storage unavailable (private window, blocked site data): the marker is optional.
    }
  },
};
