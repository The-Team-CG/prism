import { describe, expect, it } from "vitest";
import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  isPrismAuthenticatedSession,
  readPrismSession,
  savePrismSession,
} from "./session.js";

function createStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    snapshot: () => Object.fromEntries(data),
  };
}

describe("shared Prism session storage helpers", () => {
  it("reads a role session from the canonical storage key", () => {
    const session = { email: "ana@ayala.test", role: "client", signedInAt: "2026-06-15T00:00:00.000Z" };
    const storage = createStorage({
      [PRISM_SESSION_STORAGE_KEYS.client]: JSON.stringify(session),
    });

    expect(readPrismSession<typeof session>(PRISM_SESSION_STORAGE_KEYS.client, { storage })).toEqual(session);
  });

  it("clears a corrupt stored session instead of reading it", () => {
    const storage = createStorage({
      [PRISM_SESSION_STORAGE_KEYS.client]: "{",
    });

    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.client, { storage })).toBeNull();
    expect(storage.snapshot()).toEqual({});
  });

  it("saves and clears a role session under its canonical key only", () => {
    const session = { email: "ops@xperto.test", role: "supplier", signedInAt: "2026-06-15T00:00:00.000Z" };
    const storage = createStorage({
      "prism:unrelated-key": JSON.stringify({ stale: true }),
    });

    savePrismSession(PRISM_SESSION_STORAGE_KEYS.supplier, session, { storage });
    expect(readPrismSession<typeof session>(PRISM_SESSION_STORAGE_KEYS.supplier, { storage })).toEqual(session);

    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.supplier, { storage });
    expect(storage.snapshot()).toEqual({ "prism:unrelated-key": JSON.stringify({ stale: true }) });
  });

  it("keeps game participation separate from guest check-in state", () => {
    const checkInRequest = { eventId: "event-check-in", submittedAt: "2026-10-08T09:00:00.000Z" };
    const gameParticipant = { eventId: "event-game", credential: "opaque-game-token" };
    const storage = createStorage();

    savePrismSession(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest, checkInRequest, { storage });
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, gameParticipant, { storage });

    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest, { storage })).toEqual(checkInRequest);
    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, { storage })).toEqual(gameParticipant);

    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, { storage });

    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest, { storage })).toEqual(checkInRequest);
    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.gameParticipant, { storage })).toBeNull();
  });
});


describe("Prism authenticated session validation", () => {
  it("accepts signed flattened API sessions", () => {
    expect(
      isPrismAuthenticatedSession({
        id: "user_pmcm",
        name: "Ms. Mys",
        email: "mys@pmcm.test",
        role: "pmcm-admin",
        organization: "PMCM",
        approvalStatus: "approved",
        accessToken: "header.payload.signature",
        expiresAt: "2099-07-03T12:00:00.000Z",
        signedInAt: "2026-07-03T04:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("treats expired or unreadable session expiry as signed out", () => {
    const session = {
      id: "user_pmcm",
      name: "Ms. Mys",
      email: "mys@pmcm.test",
      role: "pmcm-admin",
      organization: "PMCM",
      approvalStatus: "approved",
      accessToken: "header.payload.signature",
      signedInAt: "2026-07-03T04:00:00.000Z",
    };

    expect(isPrismAuthenticatedSession({ ...session, expiresAt: "2001-01-01T00:00:00.000Z" })).toBe(false);
    expect(isPrismAuthenticatedSession({ ...session, expiresAt: "not-a-date" })).toBe(false);
  });

  it("rejects unsigned legacy role-only sessions", () => {
    expect(
      isPrismAuthenticatedSession({
        email: "mys@pmcm.test",
        role: "pmcm-admin",
        signedInAt: "2026-07-03T04:00:00.000Z",
      }),
    ).toBe(false);
  });
});
