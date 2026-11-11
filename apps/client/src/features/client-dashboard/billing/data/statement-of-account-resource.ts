import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

/** What the client sees of one event's money. Short freshness: a payment, a refund or a reversal changes it. */
export const clientStatementOfAccount = defineResource({
  name: "client.statement-of-account",
  staleMs: 15_000,
  fetch: (eventId: string, signal) => clientApi.events.statementOfAccount(eventId, { signal }),
});
