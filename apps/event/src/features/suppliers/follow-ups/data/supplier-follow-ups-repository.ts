import type { PrismClientOwnedSupplier, PrismUnresponsiveSupplier, RaiseClientSupplierRiskInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/api/events/${encodeURIComponent(eventId)}`;

export const supplierFollowUpsRepository = {
  unresponsive: (eventId: string) => eventApiRequest<PrismUnresponsiveSupplier[]>(`${base(eventId)}/unresponsive-suppliers`),
  clientOwned: (eventId: string) => eventApiRequest<PrismClientOwnedSupplier[]>(`${base(eventId)}/client-owned-suppliers`),
  raiseRisk: (eventId: string, id: string, input: RaiseClientSupplierRiskInput) =>
    eventApiRequest<PrismClientOwnedSupplier>(`${base(eventId)}/client-owned-suppliers/${encodeURIComponent(id)}/risk-warning`, { method: "POST", body: input }),
};
