import type { PrismGuestEventPass } from "@prism/types";
import type { GuestAccessOpenDraft, GuestSession } from "./guest-access-open-types";

export const GUEST_ACCESS_API_OFFLINE_MESSAGE =
  "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

export function normalizeAccessCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isOpenDraftValid(draft: GuestAccessOpenDraft): boolean {
  return draft.guestName.trim().length > 0 && draft.accessCode.trim().length > 0;
}

export function encodeAccessCodePath(accessCode: string): string {
  return encodeURIComponent(normalizeAccessCode(accessCode));
}

export function buildGuestSession(
  event: PrismGuestEventPass,
  guestName: string,
  openedAt: string = new Date().toISOString(),
): GuestSession {
  return {
    ...event,
    guestName: guestName.trim(),
    openedAt,
  };
}

export function resolvePostOpenPath(nextParam: string | null | undefined): string {
  if (nextParam && nextParam.startsWith("/")) return nextParam;
  return "/dashboard";
}

export function mapGuestAccessError(error: unknown, fallback = "Unable to open event"): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
