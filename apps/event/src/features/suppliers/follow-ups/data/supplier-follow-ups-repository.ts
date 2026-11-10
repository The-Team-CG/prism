import type { RaiseClientSupplierRiskInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const supplierFollowUpsRepository = {
  unresponsive: (eventId: string) => eventApi.commercial.unresponsiveSuppliers(eventId),
  clientOwned: (eventId: string) => eventApi.commercial.clientOwnedSuppliers(eventId),
  raiseRisk: (eventId: string, id: string, input: RaiseClientSupplierRiskInput) => eventApi.commercial.raiseClientSupplierRisk(eventId, id, input),
};
