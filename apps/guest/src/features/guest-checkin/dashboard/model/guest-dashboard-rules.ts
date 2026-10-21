import type { CheckInMode, CheckInPayload, FeedbackMediaMeta, FeedbackPayload, GuestNextAction, GuestSession } from "./guest-dashboard-types";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";

export function guestNextActions(checkedIn: boolean, feedbackSubmitted: boolean): GuestNextAction[] {
  return [
    { id: "check-in", label: checkedIn ? "Attendance recorded" : "Complete event check-in", detail: checkedIn ? "Your attendance is recorded for this event." : "Use the check-in panel to record your name or headcount with consent.", status: checkedIn ? "complete" : "pending" },
    { id: "feedback", label: feedbackSubmitted ? "Feedback sent for moderation" : "Share feedback after the event", detail: feedbackSubmitted ? "PMCM will review your feedback before any reuse." : "Feedback stays within the guest scope and enters PMCM moderation.", status: feedbackSubmitted ? "complete" : "pending" },
  ];
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
  return "Check-in submitted.";
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

export function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

export function checkInModeButtonClass(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground shadow-sm"
    : "text-muted-foreground hover:text-foreground";
}

export function guestEventStagePresentation(state: "completed" | "current" | "pending") {
  if (state === "completed") {
    return { className: "border-l-(--prism-sage) bg-(--prism-sage)/10", label: "Complete" };
  }
  if (state === "current") {
    return { className: "border-l-(--prism-signal) bg-(--prism-signal)/8", label: "Current step" };
  }
  return { className: "border-l-border bg-background/60", label: "Pending" };
}

export function mapGuestDashboardError(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
