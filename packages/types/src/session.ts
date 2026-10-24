import type { PrismAuthenticatedSession } from "./event-ops.js";

export const PRISM_SESSION_STORAGE_KEYS = {
  client: "prism:client-session",
  event: "prism:event-command-session",
  supplier: "prism:supplier-session",
  guest: "prism:guest-session",
  guestCheckInRequest: "prism:guest-check-in-request",
  gameParticipant: "prism:game-participant-session",
} as const;

export type PrismSessionStorageKey =
  (typeof PRISM_SESSION_STORAGE_KEYS)[keyof typeof PRISM_SESSION_STORAGE_KEYS];

export interface PrismSessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PrismSessionStorageOptions {
  storage?: PrismSessionStorageAdapter;
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

export function readPrismSession<TSession>(
  key: PrismSessionStorageKey,
  options: PrismSessionStorageOptions = {},
): TSession | null {
  const storage = sessionStorageFrom(options);
  if (!storage) return null;

  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TSession;
  } catch {
    storage.removeItem(key);
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
  sessionStorageFrom(options)?.removeItem(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const PRISM_AUTHENTICATED_SESSION_STRING_FIELDS = [
  "id",
  "name",
  "email",
  "role",
  "organization",
  "approvalStatus",
  "accessToken",
  "expiresAt",
  "signedInAt",
] as const;

function hasAuthenticatedSessionStrings(value: Record<string, unknown>) {
  return PRISM_AUTHENTICATED_SESSION_STRING_FIELDS.every((field) => typeof value[field] === "string");
}

function isUnexpired(expiresAt: string) {
  const expiry = Date.parse(expiresAt);
  return !Number.isNaN(expiry) && expiry > Date.now();
}

export function isPrismAuthenticatedSession(value: unknown): value is PrismAuthenticatedSession {
  if (!isRecord(value)) return false;
  if (!hasAuthenticatedSessionStrings(value)) return false;
  const token = value.accessToken;
  if (typeof token !== "string" || token.length === 0) return false;
  return isUnexpired(value.expiresAt as string);
}
