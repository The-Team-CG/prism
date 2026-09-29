import type { PrismFileRequirementsMatrix } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const fileRequirementsMatrixRepository = {
  load(eventId: string): Promise<PrismFileRequirementsMatrix> {
    return eventApi.events.fileRequirements(eventId);
  },
};
