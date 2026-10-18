import type { PrismClientChangeRequest } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientChangeRequestRepository = {
  list(eventId: string): Promise<PrismClientChangeRequest[]> {
    return clientApi.events.changeRequests(eventId);
  },
};
