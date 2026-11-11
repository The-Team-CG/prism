import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";

/** Where one event stands financially. Short freshness: a payment, a receipt or a supplier payout changes it. */
export const eventFinancialSummary = defineResource({
  name: "finance.event-financial-summary",
  staleMs: 15_000,
  fetch: (eventId: string, signal) => eventApi.commercial.eventFinancialSummary(eventId, { signal }),
});
