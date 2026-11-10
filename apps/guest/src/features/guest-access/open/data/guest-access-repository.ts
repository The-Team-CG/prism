import type { PrismGuestEventPass } from "@prism/types";
import { guestCall } from "@/features/guest-shared/guest-http";
import { guestSessionStorage } from "@/features/guest-shared/guest-session-storage";
import { guestApi } from "@/lib/prism-api";
import { normalizeAccessCode } from "../model/guest-access-open-rules";

export const guestAccessRepository = {
  readSession: guestSessionStorage.read,

  saveSession: guestSessionStorage.save,

  fetchEventPass(accessCode: string): Promise<PrismGuestEventPass> {
    return guestCall(() => guestApi.guest.eventPass(normalizeAccessCode(accessCode)), "Event code was not found");
  },
};
