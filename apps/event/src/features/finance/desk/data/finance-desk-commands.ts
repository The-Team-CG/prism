import { PRISM_SESSION_STORAGE_KEYS, type VerifyPaymentReceiptInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

/** What the desk can do without leaving the page: verify a client's payment and remind a client about one that is late. */
export const financeDeskCommands = {
  verify: (receiptId: string, input: VerifyPaymentReceiptInput) => eventApi.commercial.verifyPaymentReceipt(receiptId, input),
  remind: (eventId: string, milestoneId: string) => eventApi.commercial.remindClientPayment(eventId, milestoneId),
};

const LAST_SEEN_KEY = PRISM_SESSION_STORAGE_KEYS.pmcmFinanceLastSeen;

function readLastSeen(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(LAST_SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** When this browser's signed-in PMCM user last opened the desk. A convenience only: without storage nothing is marked new. */
export const financeDeskLastSeenStore = {
  get(actorId: string): string | null {
    const value = readLastSeen()[actorId];
    return typeof value === "string" ? value : null;
  },
  set(actorId: string, seenAt: string) {
    try {
      globalThis.localStorage?.setItem(LAST_SEEN_KEY, JSON.stringify({ ...readLastSeen(), [actorId]: seenAt }));
    } catch {
      // Storage unavailable (private window, blocked site data): the marker is optional.
    }
  },
};
