import type { PrismPmcmSupplierReadinessBoard } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const pmcmSupplierReadinessRepository = {
  get(eventId: string): Promise<PrismPmcmSupplierReadinessBoard> {
    return eventApi.pmcm.supplierReadiness(eventId);
  },
};
