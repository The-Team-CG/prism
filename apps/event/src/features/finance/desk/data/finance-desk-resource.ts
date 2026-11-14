import { defineResource } from "@prism/portal-query";
import { eventApi } from "@/lib/prism-api";

/** Finance across every active event. Short freshness: payments, receipts and payouts change through the day. */
export const financeDesk = defineResource({
  name: "finance.desk",
  staleMs: 15_000,
  fetch: (_key: "signed-in", signal) => eventApi.commercial.financeDesk({ signal }),
});
