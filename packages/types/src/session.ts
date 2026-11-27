import type { PrismAuthenticatedSession, PrismGuestEventPass } from "./event-ops.js";

export interface PrismGuestSession extends PrismGuestEventPass {
  openedAt: string;
  feedbackReceiptId?: string;
  /** When this device sent a check-in request. The API receipt says only that it was accepted, so this is all the pass can show. */
  checkInSentAt?: string;
  /** The event's game lobby, remembered once the guest opens it, so the Games tab can lead back to it. */
  gamesLobbySlug?: string;
}

export const PRISM_SESSION_STORAGE_KEYS = {
  client: "prism:client-session",
  event: "prism:event-command-session",
  supplier: "prism:supplier-session",
  guest: "prism:guest-session",
  guestCheckInRequest: "prism:guest-check-in-request",
  gameParticipant: "prism:game-participant-session",
  /** FR-50: the public inquiry in progress and its resume token. Not a sign-in session. */
  inquiryDraft: "prism:inquiry-draft",
  /** When the signed-in client last opened each event's files, to mark what PMCM added since. A per-browser convenience, not a sign-in session. */
  clientFilesLastSeen: "prism:client-files-last-seen",
  /** The stage each of the signed-in client's events was at when they last opened it, to say once when it moves on. A per-browser convenience. */
  clientEventStageSeen: "prism:client-event-stage-seen",
  /** The newest supplier payout the signed-in supplier has seen, to mark new money on Payments. A per-browser convenience. */
  supplierPaymentsLastSeen: "prism:supplier-payments-last-seen",
  /** Browsers trusted after an authenticator code, by sign-in email: the token that skips that step for 30 days. */
  trustedDevices: "prism:trusted-devices",
  /** When PMCM last opened the finance desk, to mark work that arrived since. A per-browser convenience. */
  pmcmFinanceLastSeen: "prism:pmcm-finance-last-seen",
} as const;

export type PrismSessionStorageKey =
  (typeof PRISM_SESSION_STORAGE_KEYS)[keyof typeof PRISM_SESSION_STORAGE_KEYS];

/**
 * Navigation-only cookies that mirror each portal's sign-in state so the Next proxy can redirect
 * signed-out visitors before a dashboard renders. The value is the session expiry, never the
 * access token. The API stays the security authority for every request.
 */
export const PRISM_SESSION_COOKIE_NAMES = {
  client: "prism_client_session",
  event: "prism_event_session",
  supplier: "prism_supplier_session",
  guest: "prism_guest_session",
} as const;

/**
 * Sign-in redesign: the API's own session cookies, one per portal. HttpOnly, so page scripts never read the token;
 * the API picks the one matching the portal a request comes from.
 */
export const PRISM_API_SESSION_COOKIE_NAMES = {
  client: "prism_api_client",
  supplier: "prism_api_supplier",
  event: "prism_api_event",
} as const;
export type PrismApiSessionPortal = keyof typeof PRISM_API_SESSION_COOKIE_NAMES;

/** Guest access passes carry no expiry, so their cookie is a browser-session cookie with this value. */
export const PRISM_OPEN_ENDED_SESSION_COOKIE_VALUE = "open-ended";

const SESSION_COOKIE_NAME_BY_STORAGE_KEY = new Map<string, string>([
  [PRISM_SESSION_STORAGE_KEYS.client, PRISM_SESSION_COOKIE_NAMES.client],
  [PRISM_SESSION_STORAGE_KEYS.event, PRISM_SESSION_COOKIE_NAMES.event],
  [PRISM_SESSION_STORAGE_KEYS.supplier, PRISM_SESSION_COOKIE_NAMES.supplier],
  [PRISM_SESSION_STORAGE_KEYS.guest, PRISM_SESSION_COOKIE_NAMES.guest],
]);

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

function writeSessionCookie(name: string, value: string, maxAgeSeconds?: number) {
  const target = (globalThis as { document?: { cookie: string } }).document;
  if (!target) return;
  const secure = (globalThis as { location?: { protocol?: string } }).location?.protocol === "https:";
  const maxAge = maxAgeSeconds === undefined ? "" : `; Max-Age=${maxAgeSeconds}`;
  target.cookie = `${name}=${value}; Path=/; SameSite=Lax${maxAge}${secure ? "; Secure" : ""}`;
}

/** Mirrors the signed-in state for the four portal auth keys. Other keys have no cookie. */
function mirrorSessionCookie(key: PrismSessionStorageKey, session: unknown) {
  const name = SESSION_COOKIE_NAME_BY_STORAGE_KEY.get(key);
  if (!name) return;
  if (session === undefined) {
    writeSessionCookie(name, "", 0);
    return;
  }
  if (key === PRISM_SESSION_STORAGE_KEYS.guest) {
    writeSessionCookie(name, PRISM_OPEN_ENDED_SESSION_COOKIE_VALUE);
    return;
  }
  const expiresAt = isRecord(session) ? session.expiresAt : undefined;
  const expiry = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
  if (typeof expiresAt !== "string" || Number.isNaN(expiry)) {
    writeSessionCookie(name, "", 0);
    return;
  }
  writeSessionCookie(name, expiresAt, Math.floor((expiry - Date.now()) / 1000));
}

/** True for keys without a cookie; for the four portal auth keys, true only while the browser cookie is active. */
function isSessionCookieActiveFor(key: PrismSessionStorageKey) {
  const name = SESSION_COOKIE_NAME_BY_STORAGE_KEY.get(key);
  if (!name) return true;
  const cookies = (globalThis as { document?: { cookie: string } }).document?.cookie ?? "";
  const value = cookies.split("; ").find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
  return isPrismSessionCookieActive(value, new Date());
}

/** Pure check used by the Next proxies: the cookie is active while its session expiry is in the future. */
export function isPrismSessionCookieActive(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  if (value === PRISM_OPEN_ENDED_SESSION_COOKIE_VALUE) return true;
  const expiry = Date.parse(value);
  return !Number.isNaN(expiry) && expiry > now.getTime();
}

export function readPrismSession<TSession>(
  key: PrismSessionStorageKey,
  options: PrismSessionStorageOptions = {},
): TSession | null {
  const storage = sessionStorageFrom(options);
  if (!storage) return null;

  const raw = storage.getItem(key);
  if (!raw) return null;

  // A portal session counts only while its navigation cookie is active, so the sign-in page and the
  // proxy agree. Sessions saved before the cookie existed are cleared and the person signs in again.
  if (!isSessionCookieActiveFor(key)) {
    clearPrismSession(key, options);
    return null;
  }

  try {
    return JSON.parse(raw) as TSession;
  } catch {
    clearPrismSession(key, options);
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
  storage.setItem(key, JSON.stringify(withoutCookieSessionToken(key, session)));
  mirrorSessionCookie(key, session);
}

/** Client, supplier and PMCM portals sign in with the API's HttpOnly cookie, so their stored session drops the token. */
const COOKIE_SESSION_KEYS = new Set<string>([PRISM_SESSION_STORAGE_KEYS.client, PRISM_SESSION_STORAGE_KEYS.supplier, PRISM_SESSION_STORAGE_KEYS.event]);

function withoutCookieSessionToken<TSession>(key: string, session: TSession): TSession {
  if (!COOKIE_SESSION_KEYS.has(key) || !isRecord(session) || !("accessToken" in session)) return session;
  const { accessToken: _token, ...rest } = session as Record<string, unknown>;
  return rest as TSession;
}

export function clearPrismSession(
  key: PrismSessionStorageKey,
  options: PrismSessionStorageOptions = {},
) {
  sessionStorageFrom(options)?.removeItem(key);
  mirrorSessionCookie(key, undefined);
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

/**
 * A stored portal sign-in: who is signed in and until when. Since the sign-in redesign the token stays in the API's
 * HttpOnly cookie, so a stored session has no accessToken; an older one that still carries it is accepted too.
 */
export function isPrismAuthenticatedSession(value: unknown): value is PrismAuthenticatedSession {
  if (!isRecord(value)) return false;
  if (!hasAuthenticatedSessionStrings(value)) return false;
  if (value.accessToken !== undefined && typeof value.accessToken !== "string") return false;
  return isUnexpired(value.expiresAt as string);
}
