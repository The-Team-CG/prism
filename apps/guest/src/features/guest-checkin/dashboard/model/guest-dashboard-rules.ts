import type { CheckInMode, CheckInPayload, FeedbackMediaMeta, FeedbackPayload, GuestSession } from "./guest-dashboard-types";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
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

export function guestApiPath(session: GuestSession, suffix = ""): string {
  return `/api/guest/events/${encodeURIComponent(session.guestAccessCode)}${suffix}`;
}

export function buildCheckInPayload(input: {
  session: GuestSession;
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

export function checkInSuccessNotice(): string {
  return "Check-in request received. The registration team can confirm your attendance.";
}

export function checkInButtonLabel(checkedIn: boolean): string {
  if (checkedIn) return "Check-in submitted";
  return "Submit check-in";
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

export function toMediaMeta(file: File): FeedbackMediaMeta {
  return {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function buildFeedbackPayload(input: {
  session: GuestSession;
  guestName: string;
  rating: string;
  comment: string;
  consentAccepted: boolean;
  photo?: File | null;
  video?: File | null;
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
  if (input.photo) payload.photo = toMediaMeta(input.photo);
  if (input.video) payload.video = toMediaMeta(input.video);
  return payload;
}

export function checkInModeButtonClass(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground shadow-sm"
    : "text-muted-foreground hover:text-foreground";
}

export function mapGuestDashboardError(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
