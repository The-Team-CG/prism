import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRISM_OPEN_ENDED_SESSION_COOKIE_VALUE,
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  isPrismAuthenticatedSession,
  isPrismSessionCookieActive,
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

/** A browser-like cookie jar: a write with Max-Age=0 deletes, a read returns "name=value; ...". */
function stubCookieJar() {
  const jar = new Map<string, string>();
  vi.stubGlobal("document", {
    set cookie(value: string) {
      const pair = value.split("; ")[0] ?? "";
      const name = pair.slice(0, pair.indexOf("="));
      if (/Max-Age=0(;|$)/.test(value)) jar.delete(name);
      else jar.set(name, pair.slice(name.length + 1));
    },
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
  });
}

describe("shared Prism session storage helpers", () => {
  beforeEach(() => stubCookieJar());
  afterEach(() => vi.unstubAllGlobals());

  it("reads a role session from the canonical storage key", () => {
    const session = { email: "ana@ayala.test", role: "client", signedInAt: "2026-06-15T00:00:00.000Z", expiresAt: "2099-06-15T00:00:00.000Z" };
    const storage = createStorage();
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.client, session, { storage });

    expect(readPrismSession<typeof session>(PRISM_SESSION_STORAGE_KEYS.client, { storage })).toEqual(session);
  });

  it("clears a stored portal session whose navigation cookie is missing", () => {
    const storage = createStorage({
      [PRISM_SESSION_STORAGE_KEYS.client]: JSON.stringify({ email: "ana@ayala.test", expiresAt: "2099-06-15T00:00:00.000Z" }),
    });

    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.client, { storage })).toBeNull();
    expect(storage.snapshot()).toEqual({});
  });

  it("clears a corrupt stored session instead of reading it", () => {
    const storage = createStorage({
      [PRISM_SESSION_STORAGE_KEYS.client]: "{",
    });

    expect(readPrismSession(PRISM_SESSION_STORAGE_KEYS.client, { storage })).toBeNull();
    expect(storage.snapshot()).toEqual({});
  });

  it("saves and clears a role session under its canonical key only", () => {
    const session = { email: "ops@xperto.test", role: "supplier", signedInAt: "2026-06-15T00:00:00.000Z", expiresAt: "2099-06-15T00:00:00.000Z" };
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


describe("Prism session navigation cookies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubDocumentCookie() {
    const writes: string[] = [];
    vi.stubGlobal("document", {
      set cookie(value: string) {
        writes.push(value);
      },
      get cookie() {
        return "";
      },
    });
    return writes;
  }

  it("is active only while the cookie's session expiry is in the future", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");

    expect(isPrismSessionCookieActive(undefined, now)).toBe(false);
    expect(isPrismSessionCookieActive("", now)).toBe(false);
    expect(isPrismSessionCookieActive("2026-06-14T23:59:59.000Z", now)).toBe(false);
    expect(isPrismSessionCookieActive("not-a-date", now)).toBe(false);
    expect(isPrismSessionCookieActive("2026-06-15T08:00:00.000Z", now)).toBe(true);
    expect(isPrismSessionCookieActive(PRISM_OPEN_ENDED_SESSION_COOKIE_VALUE, now)).toBe(true);
  });

  it("mirrors sign-in into a cookie that carries only the expiry and is removed on clear", () => {
    const writes = stubDocumentCookie();
    vi.stubGlobal("location", { protocol: "https:" });
    const storage = createStorage();
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

    savePrismSession(PRISM_SESSION_STORAGE_KEYS.client, { expiresAt, accessToken: "bearer-secret" }, { storage });
    expect(writes[writes.length - 1]).toMatch(/^prism_client_session=\S+; Path=\/; SameSite=Lax; Max-Age=(3599|3600); Secure$/);
    expect(writes[writes.length - 1]).toContain(`prism_client_session=${expiresAt};`);
    expect(writes[writes.length - 1]).not.toContain("bearer-secret");

    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client, { storage });
    expect(writes[writes.length - 1]).toBe("prism_client_session=; Path=/; SameSite=Lax; Max-Age=0; Secure");
  });

  it("expires the cookie for a signed session with no expiry and keeps guest passes open-ended", () => {
    const writes = stubDocumentCookie();
    const storage = createStorage();

    savePrismSession(PRISM_SESSION_STORAGE_KEYS.supplier, { accessToken: "token" }, { storage });
    expect(writes[writes.length - 1]).toBe("prism_supplier_session=; Path=/; SameSite=Lax; Max-Age=0");

    savePrismSession(PRISM_SESSION_STORAGE_KEYS.guest, { id: "event-1", openedAt: "2026-06-15T00:00:00.000Z" }, { storage });
    expect(writes[writes.length - 1]).toBe(`prism_guest_session=${PRISM_OPEN_ENDED_SESSION_COOKIE_VALUE}; Path=/; SameSite=Lax`);

    const writeCount = writes.length;
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest, { sessionId: "event-1" }, { storage });
    expect(writes).toHaveLength(writeCount);
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
