import type { PrismFileRequirementsMatrix, PrismUser } from "@prism/types";
import { clientApi, isClientLocalDemoMode } from "@/lib/prism-api";
import { prismApi as samplePrismApi } from "@/compatibility/sample/prism-api";

export const clientFileRequirementsRepository = {
  load(
    eventId: string,
    session: Pick<PrismUser, "name" | "email">,
  ): Promise<PrismFileRequirementsMatrix> {
    if (isClientLocalDemoMode) return samplePrismApi.fileRequirements(eventId, session);
    return clientApi.events.fileRequirements(eventId);
  },
};
