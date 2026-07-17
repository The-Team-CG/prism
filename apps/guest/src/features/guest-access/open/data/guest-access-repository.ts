import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  savePrismSession,
  type PrismGuestEventPass,
} from "@prism/types";
import { guestJson } from "@/features/guest-shared/guest-http";
import { encodeAccessCodePath } from "../model/guest-access-open-rules";
import type { GuestSession } from "../model/guest-access-open-types";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;

export const guestAccessRepository = {
  readSession(): GuestSession | null {
    return readPrismSession<GuestSession>(SESSION_KEY);
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
