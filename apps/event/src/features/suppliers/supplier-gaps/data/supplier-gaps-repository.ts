import type { AcknowledgeSupplierGapInput, PrismSupplierGap } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const supplierGapsRepository = {
  list: (eventId: string) => eventApiRequest<PrismSupplierGap[]>(`/api/events/${eventId}/supplier-gaps`),
  acknowledge: (eventId: string, categoryId: string, input: AcknowledgeSupplierGapInput) =>
    eventApiRequest<PrismSupplierGap>(`/api/events/${eventId}/supplier-gaps/${categoryId}/acknowledge`, { method: "POST", body: input }),
};
