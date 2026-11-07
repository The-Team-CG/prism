import type { PrismGuestEventPass } from "@prism/types";
import { guestJson } from "@/features/guest-shared/guest-http";
import { guestSessionStorage } from "@/features/guest-shared/guest-session-storage";
import { encodeAccessCodePath } from "../model/guest-access-open-rules";

export const guestAccessRepository = {
  readSession: guestSessionStorage.read,

  saveSession: guestSessionStorage.save,

  fetchEventPass(accessCode: string): Promise<PrismGuestEventPass> {
    return guestJson<PrismGuestEventPass>(
      `/api/guest/events/${encodeAccessCodePath(accessCode)}`,
      {},
      "Event code was not found",
    );
  },
};
