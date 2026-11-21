import { daysUntil, formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import type { CheckInMode, CheckInPayload, FeedbackPayload } from "./guest-dashboard-types";
import { PRISM_PRIVACY_NOTICE_VERSION, type PrismGuestSession } from "@prism/types";
import { GuestApiError } from "@/features/guest-shared/guest-http";

const GUEST_ACCESS_ENDED_STATUSES: readonly number[] = [401, 403, 404, 410];

/** The API no longer accepts this guest's access to the event; the stored session must be dropped. */
export function isGuestAccessEndedError(error: unknown): boolean {
  return error instanceof GuestApiError && GUEST_ACCESS_ENDED_STATUSES.includes(error.status);
}

export const POLL_INTERVAL_MS = 20_000;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_DURATION_S = 60;
export { GUEST_API_OFFLINE_MESSAGE as GUEST_DASHBOARD_API_OFFLINE_MESSAGE } from "@/features/guest-shared/guest-messages";

export function buildCheckInPayload(input: {
  session: PrismGuestSession;
  checkInMode: CheckInMode;
  guestName?: string;
  consentAccepted: boolean;
}): CheckInPayload {
  if (!input.consentAccepted) {
    throw new Error("Privacy consent is required to check in.");
  }

  const consent = {
    privacyConsentAccepted: true as const,
    privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  };
  if (input.checkInMode === "headcount") {
    return { checkInMode: "headcount", ...consent };
  }
  const guestName = input.guestName?.trim();
  if (!guestName) throw new Error("Enter your name for name-based check-in.");
  return {
    checkInMode: "name_search",
    guestName,
    ...consent,
  };
}

export function isFileWithinSizeLimit(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE_BYTES;
}

export function isVideoDurationAllowed(durationSeconds: number): boolean {
  return durationSeconds <= MAX_VIDEO_DURATION_S;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildFeedbackPayload(input: {
  session: PrismGuestSession;
  guestName: string;
  rating: string;
  comment: string;
  consentAccepted: boolean;
  photoObjectId?: string;
  videoObjectId?: string;
}): FeedbackPayload {
  const guestName = input.guestName.trim();
  if (!guestName) throw new Error("Enter your name for feedback.");
  const payload: FeedbackPayload = {
    guestName,
    rating: Number(input.rating),
    comment: input.comment,
    privacyConsentAccepted: input.consentAccepted,
    privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  };
  if (input.photoObjectId) payload.photoObjectId = input.photoObjectId;
  if (input.videoObjectId) payload.videoObjectId = input.videoObjectId;
  return payload;
}

export function mapGuestDashboardError(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

/** "18:30" → "6:30 PM"; anything unexpected is shown as recorded rather than guessed. */
export function formatArrivalTime(value?: string): string | undefined {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value || undefined;
  const hours = Number(match[1]);
  if (hours > 23) return value;
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
}

/** Check-in opens on the event's Philippine calendar day; before that the pass leads with event details. */
export function isGuestCheckInOpen(eventDate: string, now = new Date()): boolean {
  const day = eventDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
  return manilaDateKey(now) >= day;
}

/** Where the guest is in the event, which decides what the pass leads with. */
export type GuestPassMoment = "before" | "today" | "after";

export function guestPassMoment(session: Pick<PrismGuestSession, "eventDate" | "feedbackAvailability">, now = new Date()): GuestPassMoment {
  if (session.feedbackAvailability !== "not_open") return "after";
  return isGuestCheckInOpen(session.eventDate, now) ? "today" : "before";
}

/** "Tomorrow", "10 days to go"; nothing on or after the day. */
export function guestCountdownLabel(eventDate: string, now = new Date()): string | null {
  const days = daysUntil(eventDate.slice(0, 10), manilaDateKey(now));
  if (days === null || days <= 0) return null;
  return days === 1 ? "Tomorrow" : `${days} days to go`;
}

/** "Sat, 1 Dec" for the pass: the weekday matters to a guest planning to come. */
export function formatPassDate(eventDate: string): string {
  const day = eventDate.slice(0, 10);
  const date = new Date(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime())) return formatPortalDate(eventDate);
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** A map search for the venue, opened only when the guest taps Directions. */
export function venueDirectionsUrl(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * A calendar file for the event. A confirmed start time becomes a timed entry in Philippine time; without one the
 * entry is all-day, rather than a guessed hour. No end is given because none is recorded.
 */
export function guestCalendarFile(session: Pick<PrismGuestSession, "id" | "eventName" | "eventDate" | "venue" | "startTime">, now = new Date()): string {
  const day = session.eventDate.slice(0, 10).replace(/-/g, "");
  const time = session.startTime?.match(/^(\d{1,2}):(\d{2})/);
  const start = time && Number(time[1]) < 24
    ? `DTSTART;TZID=Asia/Manila:${day}T${time[1].padStart(2, "0")}${time[2]}00`
    : `DTSTART;VALUE=DATE:${day}`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PRISM//Guest pass//EN",
    "BEGIN:VEVENT",
    `UID:${session.id}@prism-guest-pass`,
    `DTSTAMP:${stamp}`,
    start,
    `SUMMARY:${icsText(session.eventName)}`,
    ...(session.venue ? [`LOCATION:${icsText(session.venue)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
