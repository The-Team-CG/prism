import type { PrismHandoffBrief } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const handoffBriefRepository = {
  get(eventId: string): Promise<PrismHandoffBrief> {
    return eventApi.liveOps.handoffBrief(eventId);
  },
};
