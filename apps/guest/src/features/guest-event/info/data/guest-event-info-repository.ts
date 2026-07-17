import type { PrismGuestEventPass } from "@prism/types";
import {
  decodeAccessCodeParam,
  GUEST_INFO_API_OFFLINE_MESSAGE,
} from "../model/guest-event-info-rules";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch (error) {
    if (error instanceof TypeError) throw new Error(GUEST_INFO_API_OFFLINE_MESSAGE);
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || "Event not found");
  }
  return body.data as T;
}

export const guestEventInfoRepository = {
  fetchEvent(accessCodeParam: string): Promise<PrismGuestEventPass> {
    const code = decodeAccessCodeParam(accessCodeParam);
    return request<PrismGuestEventPass>(
      `/api/guest/events/${encodeURIComponent(code)}`,
    );
  },
};
