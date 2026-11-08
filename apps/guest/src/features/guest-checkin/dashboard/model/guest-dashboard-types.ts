import type { CreateGuestCheckInInput } from "@prism/types";

export type CheckInMode = CreateGuestCheckInInput["checkInMode"];

export type GuestDashboardStatus = "idle" | "loading" | "ready" | "error";

export type GuestBusyAction = "check-in" | "feedback" | null;

type WithoutIdempotencyKey<T> = T extends { idempotencyKey: string } ? Omit<T, "idempotencyKey"> : never;

export type CheckInPayload = WithoutIdempotencyKey<CreateGuestCheckInInput>;

export type FeedbackPayload = {
  guestName: string;
  rating: number;
  comment?: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
  /** Stored upload ids from the guest feedback media route. */
  photoObjectId?: string;
  videoObjectId?: string;
};
