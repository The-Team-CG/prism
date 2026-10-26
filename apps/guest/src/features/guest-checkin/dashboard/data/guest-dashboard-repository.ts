import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  savePrismSession,
  type CreateGuestCheckInInput,
  type PrismGuestEventPass,
  type PrismGuestEventWatermark,
  type PrismGuestCheckInReceipt,
  type CreateGuestFeedbackInput,
} from "@prism/types";
import { guestJson } from "@/features/guest-shared/guest-http";
import { sanitizeGuestSession } from "@/features/guest-shared/guest-session-storage";
import { guestApiPath } from "../model/guest-dashboard-rules";
import type { CheckInPayload, GuestSession } from "../model/guest-dashboard-types";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;

type PendingGuestCheckIn = {
  sessionId: string;
  payloadFingerprint: string;
  idempotencyKey: string;
};

const inMemoryPendingCheckIns = new Map<string, PendingGuestCheckIn>();

function checkInPayloadFingerprint(payload: CheckInPayload): string {
  const normalized = JSON.stringify({
    checkInMode: payload.checkInMode,
    guestName: payload.checkInMode === "name_search" ? payload.guestName.trim().toLowerCase() : null,
    privacyConsentAccepted: payload.privacyConsentAccepted,
    privacyNoticeVersion: payload.privacyNoticeVersion,
    marketingConsentAccepted: payload.marketingConsentAccepted ?? false,
  });
  let hash = 2_166_136_261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16);
}

function browserSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function discardPendingCheckIn(storage: Storage | null): void {
  try {
    storage?.removeItem(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest);
  } catch {
    // Storage can be disabled by the browser; the in-memory key remains available.
  }
}

function readPendingCheckIn(storage: Storage | null): PendingGuestCheckIn | null {
  try {
    const cached = storage?.getItem(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest);
    if (!cached) return null;

    const value = JSON.parse(cached) as Partial<PendingGuestCheckIn>;
    if (typeof value.sessionId === "string"
      && typeof value.payloadFingerprint === "string"
      && /^[0-9a-f]{8}$/.test(value.payloadFingerprint)
      && typeof value.idempotencyKey === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.idempotencyKey)) {
      return value as PendingGuestCheckIn;
    }
  } catch {
    // Storage can be disabled by the browser; the in-memory key remains available.
  }
  discardPendingCheckIn(storage);
  return null;
}

function getPendingCheckInKey(session: GuestSession, payload: CheckInPayload): string {
  const storage = browserSessionStorage();
  const payloadFingerprint = checkInPayloadFingerprint(payload);
  const pending = readPendingCheckIn(storage) ?? inMemoryPendingCheckIns.get(session.id) ?? null;
  if (pending?.sessionId === session.id && pending.payloadFingerprint === payloadFingerprint) {
    return pending.idempotencyKey;
  }

  const next = {
    sessionId: session.id,
    payloadFingerprint,
    idempotencyKey: globalThis.crypto.randomUUID(),
  };
  inMemoryPendingCheckIns.set(session.id, next);
  try {
    storage?.setItem(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest, JSON.stringify(next));
  } catch {
    // The in-memory entry still covers retries in the current page session.
  }
  return next.idempotencyKey;
}

function clearPendingCheckIn(session: GuestSession, idempotencyKey: string): void {
  const storage = browserSessionStorage();
  const pending = readPendingCheckIn(storage);
  if (pending?.sessionId === session.id && pending.idempotencyKey === idempotencyKey) {
    try {
      storage?.removeItem(PRISM_SESSION_STORAGE_KEYS.guestCheckInRequest);
    } catch {
      // The request is already accepted; stale storage will be replaced by a new payload.
    }
  }
  const cached = inMemoryPendingCheckIns.get(session.id);
  if (cached?.idempotencyKey === idempotencyKey) inMemoryPendingCheckIns.delete(session.id);
}

export const guestDashboardRepository = {
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

  clearSession(): void {
    clearPrismSession(SESSION_KEY);
  },

  fetchEvent(session: GuestSession): Promise<PrismGuestEventPass> {
    return guestJson<PrismGuestEventPass>(guestApiPath(session));
  },

  fetchWatermark(session: GuestSession): Promise<PrismGuestEventWatermark> {
    return guestJson<PrismGuestEventWatermark>(guestApiPath(session, "/watermark"));
  },

  checkIn(session: GuestSession, payload: CheckInPayload): Promise<PrismGuestCheckInReceipt> {
    const idempotencyKey = getPendingCheckInKey(session, payload);
    return guestJson<PrismGuestCheckInReceipt>(guestApiPath(session, "/check-ins"), {
      method: "POST",
      body: JSON.stringify({ ...payload, idempotencyKey } satisfies CreateGuestCheckInInput),
    }).then((receipt) => {
      clearPendingCheckIn(session, idempotencyKey);
      return receipt;
    });
  },

  submitFeedback(session: GuestSession, payload: CreateGuestFeedbackInput): Promise<unknown> {
    return guestJson(guestApiPath(session, "/feedback"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
