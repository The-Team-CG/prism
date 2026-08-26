/**
 * Shared guest-portal HTTP helper (DRY across feature repositories).
 */

import { GUEST_API_OFFLINE_MESSAGE } from "./guest-messages";

export { GUEST_API_OFFLINE_MESSAGE } from "./guest-messages";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function errorMessage(body: { message?: unknown }, fallback: string): string {
  if (Array.isArray(body.message)) return body.message.join(", ");
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  return fallback;
}

export async function guestJson<T>(
  path: string,
  init: RequestInit = {},
  fallbackError = `Request failed`,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(GUEST_API_OFFLINE_MESSAGE);
    throw error;
  }

  const body = (await response.json().catch(() => ({}))) as { message?: unknown; data?: T };
  if (!response.ok) {
    throw new Error(errorMessage(body, `${fallbackError}: ${response.status}`));
  }
  return body.data as T;
}
