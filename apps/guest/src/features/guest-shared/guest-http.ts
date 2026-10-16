/**
 * Shared guest-portal HTTP helper (DRY across feature repositories).
 */

import { resolvePrismApiOrigin } from "@prism/api-client";
import { GUEST_API_OFFLINE_MESSAGE } from "./guest-messages";

export { GUEST_API_OFFLINE_MESSAGE } from "./guest-messages";

export class GuestHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GuestHttpError";
  }
}

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
    response = await fetch(`${resolvePrismApiOrigin()}${path}`, {
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
    throw new GuestHttpError(errorMessage(body, `${fallbackError}: ${response.status}`), response.status);
  }
  return body.data as T;
}
