import {
  buildCheckInPayload,
  buildFeedbackPayload,
  checkInSuccessNotice,
} from "../model/guest-dashboard-rules";
import type { CheckInMode, GuestSession } from "../model/guest-dashboard-types";
import { guestDashboardRepository } from "../data/guest-dashboard-repository";
import { createGuestFeedbackSchema, parseContract } from "@prism/types";

export function loadGuestDashboardSession(): GuestSession | null {
  return guestDashboardRepository.readSession();
}

export async function refreshGuestEvent(
  session: GuestSession,
): Promise<GuestSession> {
  const event = await guestDashboardRepository.fetchEvent(session);
  const next = { ...session, ...event };
  guestDashboardRepository.saveSession(next);
  return next;
}

export async function refreshGuestEventIfChanged(
  session: GuestSession,
): Promise<GuestSession> {
  const { watermark, feedbackAvailability } = await guestDashboardRepository.fetchWatermark(session);
  if (session.watermark === watermark && session.feedbackAvailability === feedbackAvailability) return session;
  if (session.watermark === watermark) {
    const next = { ...session, feedbackAvailability };
    guestDashboardRepository.saveSession(next);
    return next;
  }
  return refreshGuestEvent(session);
}

export async function submitGuestCheckIn(input: {
  session: GuestSession;
  checkInMode: CheckInMode;
  guestName?: string;
  consentAccepted: boolean;
}): Promise<{ session: GuestSession; notice: string }> {
  const payload = buildCheckInPayload(input);
  await guestDashboardRepository.checkIn(input.session, payload);
  let session = input.session;
  try {
    session = await refreshGuestEvent(input.session);
  } catch {
    // stale data acceptable after successful check-in
  }
  return {
    session,
    notice: checkInSuccessNotice(),
  };
}

export async function submitGuestFeedback(input: {
  session: GuestSession;
  guestName: string;
  rating: string;
  comment: string;
  consentAccepted: boolean;
  photo?: File | null;
  video?: File | null;
}): Promise<void> {
  const payload = buildFeedbackPayload(input);
  await guestDashboardRepository.submitFeedback(
    input.session,
    parseContract(createGuestFeedbackSchema, payload, "Guest feedback"),
  );
}

export function leaveGuestEvent(): void {
  guestDashboardRepository.clearSession();
}
