import { safeNextPath, type PrismGuestEventPass } from "@prism/types";
import type { GuestAccessOpenDraft, GuestSession } from "./guest-access-open-types";

export { GUEST_API_OFFLINE_MESSAGE as GUEST_ACCESS_API_OFFLINE_MESSAGE } from "@/features/guest-shared/guest-messages";

export function normalizeAccessCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isOpenDraftValid(draft: GuestAccessOpenDraft): boolean {
  return draft.accessCode.trim().length > 0;
}

export function encodeAccessCodePath(accessCode: string): string {
  return encodeURIComponent(normalizeAccessCode(accessCode));
}

export function buildGuestSession(
  event: PrismGuestEventPass,
  openedAt: string = new Date().toISOString(),
): GuestSession {
  return {
    id: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate,
    clientName: event.clientName,
    readiness: event.readiness,
    floorPlanStatus: event.floorPlanStatus,
    ...(event.activeFloorPlanDraftId ? { activeFloorPlanDraftId: event.activeFloorPlanDraftId } : {}),
    guestAccessCode: event.guestAccessCode,
    watermark: event.watermark,
    feedbackAvailability: event.feedbackAvailability,
    openedAt,
  };
}

export function resolvePostOpenPath(nextParam: string | null | undefined): string {
  return safeNextPath(nextParam, "/dashboard");
}

export function mapGuestAccessError(error: unknown, fallback = "Unable to open event"): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
