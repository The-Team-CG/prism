import { createEventOpsClient } from "@prism/api-client";
import type { PrismGuestEventPass } from "@prism/types";

export type GuestSession = PrismGuestEventPass & {
  guestName: string;
  openedAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const eventOpsClient = createEventOpsClient({ baseUrl: `${API_URL}/api` });

export const prismApi = {
  eventPass: (accessCode: string) =>
    eventOpsClient.guest.eventPass(accessCode),

  checkIn: (accessCode: string, input: {
    guestName: string;
    checkInMode?: string;
    walkIn?: boolean;
    verificationStatus?: string;
    privacyConsentAccepted?: boolean;
    privacyNoticeVersion?: string;
    marketingConsentAccepted?: boolean;
  }) =>
    eventOpsClient.guest.checkIn(accessCode, input),

  feedback: (accessCode: string, input: {
    guestName: string;
    rating: number;
    comment?: string;
    privacyConsentAccepted?: boolean;
    privacyNoticeVersion?: string;
    marketingConsentAccepted?: boolean;
  }) =>
    eventOpsClient.guest.feedback(accessCode, input),
};
