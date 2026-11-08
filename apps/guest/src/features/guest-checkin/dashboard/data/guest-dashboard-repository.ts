import {
  PRISM_SESSION_STORAGE_KEYS,
  type CreateGuestCheckInInput,
  type CreateGuestFeedbackInput,
  type PrismGuestCheckInReceipt,
  type PrismGuestEventPass,
  type PrismGuestEventWatermark,
  type PrismGuestFeedbackMediaUpload,
  type PrismGuestFeedbackReceipt,
  type PrismGuestSession,
  type WithdrawGuestFeedbackConsentInput,
} from "@prism/types";
import { guestJson } from "@/features/guest-shared/guest-http";
import { guestSessionStorage } from "@/features/guest-shared/guest-session-storage";
import { guestApiPath } from "../model/guest-dashboard-rules";
import type { CheckInPayload } from "../model/guest-dashboard-types";

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

function getPendingCheckInKey(session: PrismGuestSession, payload: CheckInPayload): string {
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

function clearPendingCheckIn(session: PrismGuestSession, idempotencyKey: string): void {
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
  readSession: guestSessionStorage.read,

  saveSession: guestSessionStorage.save,

  clearSession: guestSessionStorage.clear,

  fetchEvent(session: PrismGuestSession): Promise<PrismGuestEventPass> {
    return guestJson<PrismGuestEventPass>(guestApiPath(session));
  },

  fetchWatermark(session: PrismGuestSession): Promise<PrismGuestEventWatermark> {
    return guestJson<PrismGuestEventWatermark>(guestApiPath(session, "/watermark"));
  },

  checkIn(session: PrismGuestSession, payload: CheckInPayload): Promise<PrismGuestCheckInReceipt> {
    const idempotencyKey = getPendingCheckInKey(session, payload);
    return guestJson<PrismGuestCheckInReceipt>(guestApiPath(session, "/check-ins"), {
      method: "POST",
      body: JSON.stringify({ ...payload, idempotencyKey } satisfies CreateGuestCheckInInput),
    }).then((receipt) => {
      clearPendingCheckIn(session, idempotencyKey);
      return receipt;
    });
  },

  withdrawFeedbackConsent(session: PrismGuestSession, feedbackId: string, payload: WithdrawGuestFeedbackConsentInput): Promise<unknown> {
    return guestJson(guestApiPath(session, `/feedback/${encodeURIComponent(feedbackId)}/consent-withdrawal`), { method: "POST", body: JSON.stringify(payload) });
  },

  /** Sends the file bytes; the API checks the file type and size before storing them. */
  uploadFeedbackMedia(session: PrismGuestSession, file: File): Promise<PrismGuestFeedbackMediaUpload> {
    return guestJson<PrismGuestFeedbackMediaUpload>(guestApiPath(session, "/feedback-media"), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "x-prism-file-name": encodeURIComponent(file.name) },
      body: file,
    }, "Could not upload the file");
  },

  submitFeedback(session: PrismGuestSession, payload: CreateGuestFeedbackInput): Promise<PrismGuestFeedbackReceipt> {
    return guestJson<PrismGuestFeedbackReceipt>(guestApiPath(session, "/feedback"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
