import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  savePrismSession,
  type PrismGuestEventPass,
} from "@prism/types";
import {
  encodeAccessCodePath,
  GUEST_ACCESS_API_OFFLINE_MESSAGE,
} from "../model/guest-access-open-rules";
import type { GuestSession } from "../model/guest-access-open-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.guest;

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch (error) {
    if (error instanceof TypeError) throw new Error(GUEST_ACCESS_API_OFFLINE_MESSAGE);
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || "Event code was not found");
  }
  return body.data as T;
}

export const guestAccessRepository = {
  readSession(): GuestSession | null {
    return readPrismSession<GuestSession>(SESSION_KEY);
  },

  saveSession(session: GuestSession): void {
    savePrismSession(SESSION_KEY, session);
  },

  fetchEventPass(accessCode: string): Promise<PrismGuestEventPass> {
    return request<PrismGuestEventPass>(`/api/guest/events/${encodeAccessCodePath(accessCode)}`);
  },
};
