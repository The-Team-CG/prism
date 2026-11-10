import type { AcknowledgeSupplierGapInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const supplierGapsRepository = {
  list: (eventId: string) => eventApi.commercial.supplierGaps(eventId),
  acknowledge: (eventId: string, categoryId: string, input: AcknowledgeSupplierGapInput) =>
    eventApi.commercial.acknowledgeSupplierGap(eventId, categoryId, input),
};
