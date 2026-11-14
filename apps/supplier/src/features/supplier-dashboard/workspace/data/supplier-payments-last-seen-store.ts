import { PRISM_SESSION_STORAGE_KEYS } from "@prism/types";

const KEY = PRISM_SESSION_STORAGE_KEYS.supplierPaymentsLastSeen;

function read(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * When this browser's signed-in supplier last opened Payments. A convenience only: when storage is blocked or cleared,
 * only recent payouts are marked new.
 */
export const supplierPaymentsLastSeenStore = {
  get(actorId: string): string | null {
    const value = read()[actorId];
    return typeof value === "string" ? value : null;
  },
  set(actorId: string, seenAt: string) {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...read(), [actorId]: seenAt }));
    } catch {
      // Storage unavailable (private window, blocked site data): the marker is optional.
    }
  },
};
