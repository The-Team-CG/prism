import type { PrismGuestEventPass } from "@prism/types";
import { guestJson } from "@/features/guest-shared/guest-http";
import { decodeAccessCodeParam } from "../model/guest-event-info-rules";

export const guestEventInfoRepository = {
  fetchEvent(accessCodeParam: string): Promise<PrismGuestEventPass> {
    const code = decodeAccessCodeParam(accessCodeParam);
    return guestJson<PrismGuestEventPass>(
      `/api/guest/events/${encodeURIComponent(code)}`,
      {},
      "Event not found",
    );
  },
};
