/**
 * Maps the shared client's errors onto the guest portal's own error type, so the guest screens keep their messages.
 */

import { PrismApiError } from "@prism/api-client";

export { GUEST_API_OFFLINE_MESSAGE } from "./guest-messages";

export class GuestApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GuestApiError";
    this.status = status;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const message = typeof body === "object" && body !== null ? (body as { message?: unknown }).message : undefined;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

/**
 * Runs one guest request. An API refusal becomes a GuestApiError carrying the server's message, or "<fallback>: <status>"
 * when it sent none; an unreachable API already carries the guest offline message and passes through unchanged.
 */
export async function guestCall<T>(call: () => Promise<T>, fallbackError = "Request failed"): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof PrismApiError) {
      throw new GuestApiError(error.status, errorMessage(error.body, `${fallbackError}: ${error.status}`));
    }
    throw error;
  }
}
