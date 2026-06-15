import { describe, expect, it } from "vitest";
import {
  PRISM_LEGACY_SESSION_STORAGE_KEYS,
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  savePrismSession,
} from "./session";

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

  it("migrates an allowed legacy session key to the canonical key", () => {
    const session = { email: "ana@ayala.test", role: "client", signedInAt: "2026-06-15T00:00:00.000Z" };
    const storage = createStorage({
      [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth]: JSON.stringify(session),
    });

    expect(
      readPrismSession<typeof session>(PRISM_SESSION_STORAGE_KEYS.client, {
        legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
        storage,
      }),
    ).toEqual(session);
    expect(storage.snapshot()).toEqual({
      [PRISM_SESSION_STORAGE_KEYS.client]: JSON.stringify(session),
    });
  });

  it("clears corrupt canonical and legacy session values", () => {
    const storage = createStorage({
      [PRISM_SESSION_STORAGE_KEYS.client]: "{",
      [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth]: "{",
    });

    expect(
      readPrismSession(PRISM_SESSION_STORAGE_KEYS.client, {
        legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
        storage,
      }),
    ).toBeNull();
    expect(storage.snapshot()).toEqual({});
  });

  it("saves and clears canonical and legacy session keys", () => {
    const session = { email: "ops@xperto.test", role: "supplier", signedInAt: "2026-06-15T00:00:00.000Z" };
    const storage = createStorage({
      [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth]: JSON.stringify({ stale: true }),
    });

    savePrismSession(PRISM_SESSION_STORAGE_KEYS.supplier, session, { storage });
    expect(readPrismSession<typeof session>(PRISM_SESSION_STORAGE_KEYS.supplier, { storage })).toEqual(session);

    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.supplier, {
      legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
      storage,
    });
    expect(storage.snapshot()).toEqual({});
  });
});
