import type { CreateGuestCheckInInput, PrismGuestEventPass } from "@prism/types";

export type GuestSession = PrismGuestEventPass & {
  openedAt: string;
};

export type CheckInMode = CreateGuestCheckInInput["checkInMode"];

export type GuestDashboardStatus = "idle" | "loading" | "ready" | "error";

export type GuestBusyAction = "check-in" | "feedback" | null;

export type GuestNextAction = {
  id: "check-in" | "feedback";
  label: string;
  detail: string;
  status: "pending" | "complete";
};

export type CheckInPayload = CreateGuestCheckInInput;

export type FeedbackMediaMeta = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type FeedbackPayload = {
  guestName: string;
  rating: number;
  comment?: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
  photo?: FeedbackMediaMeta;
  video?: FeedbackMediaMeta;
};
