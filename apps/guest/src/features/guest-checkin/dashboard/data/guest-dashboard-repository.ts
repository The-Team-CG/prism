import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  savePrismSession,
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
    return guestJson<PrismGuestCheckInReceipt>(guestApiPath(session, "/check-ins"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitFeedback(session: GuestSession, payload: CreateGuestFeedbackInput): Promise<unknown> {
    return guestJson(guestApiPath(session, "/feedback"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
