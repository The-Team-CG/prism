import type { PrismGuestEventPass } from "@prism/types";
import type { GuestEventInfoRow } from "./guest-event-info-types";

export { GUEST_API_OFFLINE_MESSAGE as GUEST_INFO_API_OFFLINE_MESSAGE } from "@/features/guest-shared/guest-messages";

export function decodeAccessCodeParam(raw: string): string {
  return decodeURIComponent(raw);
}

export function buildEventInfoRows(event: PrismGuestEventPass): GuestEventInfoRow[] {
  return [
    { label: "Event", value: event.eventName },
    { label: "Date", value: event.eventDate },
    { label: "Client", value: event.clientName },
    { label: "Readiness", value: event.readiness.replaceAll("_", " ") },
    { label: "Floorplan", value: event.floorPlanStatus.replaceAll("_", " ") },
  ];
}

export function buildEventInfoQrUrl(guestBaseUrl: string, guestAccessCode: string): string {
  const base = guestBaseUrl.replace(/\/$/, "");
  return `${base}/info/${encodeURIComponent(guestAccessCode)}`;
}

export function mapGuestEventInfoError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Event not found";
}
