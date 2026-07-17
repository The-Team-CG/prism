import type { PrismGuestEventPass } from "@prism/types";

export type GuestSession = PrismGuestEventPass & {
  guestName: string;
  openedAt: string;
};

export type CheckInMode = "name_search" | "headcount";

export type GuestDashboardStatus = "idle" | "loading" | "ready" | "error";

export type GuestBusyAction = "check-in" | "feedback" | null;

export type CheckInPayload = {
  guestName: string;
  checkInMode: CheckInMode;
  walkIn: boolean;
  verificationStatus: "verified" | "flagged";
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
};

export type FeedbackMediaMeta = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type FeedbackPayload = {
  guestName: string;
  rating: number;
  comment: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
  photo?: FeedbackMediaMeta;
  video?: FeedbackMediaMeta;
};
