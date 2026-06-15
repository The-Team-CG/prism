export const PRISM_SESSION_STORAGE_KEYS = {
  client: "prism:client-session",
  event: "prism:event-command-session",
  supplier: "prism:supplier-session",
  guest: "prism:guest-session",
} as const;

export const PRISM_LEGACY_SESSION_STORAGE_KEYS = {
  clientMockAuth: "prism:mock-auth-session",
  clientMockAuthRequests: "prism:mock-auth-requests",
} as const;

export const PRISM_SAMPLE_STATE_STORAGE_KEY = "prism:prism-sample-state";

export type PrismSessionStorageKey =
  (typeof PRISM_SESSION_STORAGE_KEYS)[keyof typeof PRISM_SESSION_STORAGE_KEYS];

export interface PrismSessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PrismSessionStorageOptions {
  storage?: PrismSessionStorageAdapter;
  legacyKeys?: readonly string[];
}

function browserStorage() {
  const globalWithWindow = globalThis as typeof globalThis & {
    window?: { localStorage?: PrismSessionStorageAdapter };
  };
  return globalWithWindow.window?.localStorage;
}

function sessionStorageFrom(options?: PrismSessionStorageOptions) {
  return options?.storage ?? browserStorage();
}

function allSessionKeys(key: string, legacyKeys: readonly string[] = []) {
  return [key, ...legacyKeys];
}

export function readPrismSession<TSession>(
  key: PrismSessionStorageKey,
  options: PrismSessionStorageOptions = {},
): TSession | null {
  const storage = sessionStorageFrom(options);
  if (!storage) return null;

  const keys = allSessionKeys(key, options.legacyKeys);
  const sourceKey = keys.find((candidate) => storage.getItem(candidate));
  if (!sourceKey) return null;

  const raw = storage.getItem(sourceKey);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as TSession;
    if (sourceKey !== key) {
      storage.setItem(key, raw);
      storage.removeItem(sourceKey);
    }
    return session;
  } catch {
    keys.forEach((candidate) => storage.removeItem(candidate));
    return null;
  }
}

export function savePrismSession<TSession>(
  key: PrismSessionStorageKey,
  session: TSession,
  options: Pick<PrismSessionStorageOptions, "storage"> = {},
) {
  const storage = sessionStorageFrom(options);
  if (!storage) return;
  storage.setItem(key, JSON.stringify(session));
}

export function clearPrismSession(
  key: PrismSessionStorageKey,
  options: PrismSessionStorageOptions = {},
) {
  const storage = sessionStorageFrom(options);
  if (!storage) return;
  allSessionKeys(key, options.legacyKeys).forEach((candidate) => storage.removeItem(candidate));
}
