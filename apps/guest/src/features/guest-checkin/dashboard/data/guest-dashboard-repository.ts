import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  savePrismSession,
  type PrismGuestEventPass,
} from "@prism/types";
import {
  GUEST_DASHBOARD_API_OFFLINE_MESSAGE,
  guestApiPath,
} from "../model/guest-dashboard-rules";
import type {
  CheckInPayload,
  FeedbackPayload,
  GuestSession,
} from "../model/guest-dashboard-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(GUEST_DASHBOARD_API_OFFLINE_MESSAGE);
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return body.data as T;
}

export const guestDashboardRepository = {
  readSession(): GuestSession | null {
    return readPrismSession<GuestSession>(SESSION_KEY);
  },

  saveSession(session: GuestSession): void {
    savePrismSession(SESSION_KEY, session);
  },

  clearSession(): void {
    clearPrismSession(SESSION_KEY);
  },

  fetchEvent(session: GuestSession): Promise<PrismGuestEventPass> {
    return apiFetch<PrismGuestEventPass>(guestApiPath(session));
  },

  checkIn(session: GuestSession, payload: CheckInPayload): Promise<unknown> {
    return apiFetch(guestApiPath(session, "/check-ins"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitFeedback(session: GuestSession, payload: FeedbackPayload): Promise<unknown> {
    return apiFetch(guestApiPath(session, "/feedback"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
