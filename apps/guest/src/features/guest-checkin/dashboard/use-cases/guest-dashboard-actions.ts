import {
  buildCheckInPayload,
  buildFeedbackPayload,
  checkInSuccessNotice,
} from "../model/guest-dashboard-rules";
import type {
  CheckInMode,
  GuestSession,
} from "../model/guest-dashboard-types";
import { guestDashboardRepository } from "../data/guest-dashboard-repository";

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

export async function submitGuestCheckIn(input: {
  session: GuestSession;
  checkInMode: CheckInMode;
  walkIn: boolean;
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
    notice: checkInSuccessNotice(input.checkInMode, input.walkIn),
  };
}

export async function submitGuestFeedback(input: {
  session: GuestSession;
  rating: string;
  comment: string;
  consentAccepted: boolean;
  photo?: File | null;
  video?: File | null;
}): Promise<void> {
  const payload = buildFeedbackPayload(input);
  await guestDashboardRepository.submitFeedback(input.session, payload);
}

export function leaveGuestEvent(): void {
  guestDashboardRepository.clearSession();
}
