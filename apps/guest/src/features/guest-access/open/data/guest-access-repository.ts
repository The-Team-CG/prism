import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  savePrismSession,
  type PrismGuestEventPass,
} from "@prism/types";
import { guestJson } from "@/features/guest-shared/guest-http";
import { sanitizeGuestSession } from "@/features/guest-shared/guest-session-storage";
import { encodeAccessCodePath } from "../model/guest-access-open-rules";
import type { GuestSession } from "../model/guest-access-open-types";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;

export const guestAccessRepository = {
  readSession(): GuestSession | null {
    const stored = readPrismSession<GuestSession & { guestName?: unknown; attendanceCount?: unknown }>(SESSION_KEY);
    if (!stored) return null;
    const session = sanitizeGuestSession(stored) as GuestSession;
    if ("guestName" in stored || "attendanceCount" in stored) {
      savePrismSession(SESSION_KEY, session);
    }
    return session;
  },

  saveSession(session: GuestSession): void {
    savePrismSession(SESSION_KEY, session);
  },

  fetchEventPass(accessCode: string): Promise<PrismGuestEventPass> {
    return guestJson<PrismGuestEventPass>(
      `/api/guest/events/${encodeAccessCodePath(accessCode)}`,
      {},
      "Event code was not found",
    );
  },
};
