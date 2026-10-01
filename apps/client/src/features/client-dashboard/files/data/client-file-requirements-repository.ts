import type { PrismFileRequirementsMatrix } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientFileRequirementsRepository = {
  load(eventId: string): Promise<PrismFileRequirementsMatrix> {
    return clientApi.events.fileRequirements(eventId);
  },
};
