import type { PrismGuestSession } from "@prism/types";
import { guestAccessRepository } from "../data/guest-access-repository";
import {
  buildGuestSession,
  resolvePostOpenPath,
} from "../model/guest-access-open-rules";

export async function openGuestEventPass(input: {
  accessCode: string;
  nextPath?: string | null;
}): Promise<{ session: PrismGuestSession; redirectTo: string }> {
  const guestEvent = await guestAccessRepository.fetchEventPass(input.accessCode);
  const previous = guestAccessRepository.readSession();
  // Opening the same event again keeps what this device already did with it: a sent check-in, feedback, the lobby.
  const kept = previous?.id === guestEvent.id
    ? { checkInSentAt: previous.checkInSentAt, feedbackReceiptId: previous.feedbackReceiptId, gamesLobbySlug: previous.gamesLobbySlug }
    : {};
  const session = { ...buildGuestSession(guestEvent), ...stripUndefined(kept) };
  guestAccessRepository.saveSession(session);
  return {
    session,
    redirectTo: resolvePostOpenPath(input.nextPath),
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export function loadExistingGuestSession(): PrismGuestSession | null {
  return guestAccessRepository.readSession();
}
