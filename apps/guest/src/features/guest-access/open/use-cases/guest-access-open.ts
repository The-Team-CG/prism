import type { PrismGuestEventPass } from "@prism/types";
import { guestAccessRepository } from "../data/guest-access-repository";
import {
  buildGuestSession,
  resolvePostOpenPath,
} from "../model/guest-access-open-rules";
import type { GuestSession } from "../model/guest-access-open-types";

export async function previewGuestEvent(accessCode: string): Promise<PrismGuestEventPass> {
  return guestAccessRepository.fetchEventPass(accessCode);
}

export async function openGuestEventPass(input: {
  accessCode: string;
  preview?: PrismGuestEventPass | null;
  nextPath?: string | null;
}): Promise<{ session: GuestSession; redirectTo: string }> {
  const guestEvent =
    input.preview ?? (await guestAccessRepository.fetchEventPass(input.accessCode));
  const session = buildGuestSession(guestEvent);
  guestAccessRepository.saveSession(session);
  return {
    session,
    redirectTo: resolvePostOpenPath(input.nextPath),
  };
}

export function loadExistingGuestSession(): GuestSession | null {
  return guestAccessRepository.readSession();
}
