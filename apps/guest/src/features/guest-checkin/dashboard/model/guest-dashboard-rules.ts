import type { CheckInMode, CheckInPayload, FeedbackMediaMeta, FeedbackPayload, GuestSession } from "./guest-dashboard-types";

export const PRIVACY_NOTICE_VERSION = "2026-05-01";
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
  walkIn: boolean;
  consentAccepted: boolean;
}): CheckInPayload {
  const headcount = input.checkInMode === "headcount";
  return {
    guestName: headcount ? "Walk-in guest" : input.session.guestName,
    checkInMode: input.checkInMode,
    walkIn: headcount ? false : input.walkIn,
    verificationStatus: headcount ? "verified" : input.walkIn ? "flagged" : "verified",
    privacyConsentAccepted: input.consentAccepted,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  };
}

export function checkInSuccessNotice(
  checkInMode: CheckInMode,
  walkIn: boolean,
): string {
  if (checkInMode === "headcount") return "Attendance recorded.";
  if (walkIn) return "Walk-in flagged for PMCM review.";
  return "Check-in successful.";
}

export function checkInButtonLabel(input: {
  checkedIn: boolean;
  checkInMode: CheckInMode;
  walkIn: boolean;
}): string {
  if (input.checkedIn) return "Attendance recorded";
  if (input.checkInMode === "headcount") return "Record attendance";
  if (input.walkIn) return "Submit walk-in for verification";
  return "Record name check-in";
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
  rating: string;
  comment: string;
  consentAccepted: boolean;
  photo?: File | null;
  video?: File | null;
}): FeedbackPayload {
  const payload: FeedbackPayload = {
    guestName: input.session.guestName,
    rating: Number(input.rating),
    comment: input.comment,
    privacyConsentAccepted: input.consentAccepted,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  };
  if (input.photo) payload.photo = toMediaMeta(input.photo);
  if (input.video) payload.video = toMediaMeta(input.video);
  return payload;
}

export function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

export function mapGuestDashboardError(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
