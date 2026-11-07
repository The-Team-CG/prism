import { PRISM_SESSION_STORAGE_KEYS, clearPrismSession, readPrismSession, savePrismSession, type PrismGuestSession } from "@prism/types";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;

export const guestSessionStorage = {
  read(): PrismGuestSession | null {
    const stored = readPrismSession<PrismGuestSession & { guestName?: unknown; attendanceCount?: unknown }>(SESSION_KEY);
    if (!stored) return null;
    const { guestName: _guestName, attendanceCount: _attendanceCount, ...session } = stored;
    if ("guestName" in stored || "attendanceCount" in stored) savePrismSession(SESSION_KEY, session);
    return session;
  },

  save(session: PrismGuestSession): void {
    savePrismSession(SESSION_KEY, session);
  },

  clear(): void {
    clearPrismSession(SESSION_KEY);
  },
};
