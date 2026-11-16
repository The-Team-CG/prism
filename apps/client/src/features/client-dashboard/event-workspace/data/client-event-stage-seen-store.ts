import { PRISM_SESSION_STORAGE_KEYS } from "@prism/types";

type Seen = { stage: string; seenAt: string };

const KEY = PRISM_SESSION_STORAGE_KEYS.clientEventStageSeen;
/** Old visits stop mattering; keep the stored map small. */
const MAX_ENTRIES = 200;

function read(): Record<string, Seen> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, Seen>) : {};
  } catch {
    return {};
  }
}

/**
 * The stage each event was at when this browser's signed-in client last opened it. A convenience only: when storage
 * is blocked or cleared, no stage change is announced.
 */
export const clientEventStageSeenStore = {
  get(actorId: string, eventId: string): string | null {
    const value = read()[`${actorId}:${eventId}`];
    return value && typeof value.stage === "string" ? value.stage : null;
  },

  set(actorId: string, eventId: string, stage: string) {
    try {
      const entries = Object.entries({ ...read(), [`${actorId}:${eventId}`]: { stage, seenAt: new Date().toISOString() } })
        .sort(([, left], [, right]) => String(right.seenAt).localeCompare(String(left.seenAt)))
        .slice(0, MAX_ENTRIES);
      globalThis.localStorage?.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Storage unavailable (private window, blocked site data): the announcement is optional.
    }
  },
};
