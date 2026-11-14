import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

/** What the client sees of one event's money. Short freshness: a payment, a refund or a reversal changes it. */
export const clientStatementOfAccount = defineResource({
  name: "client.statement-of-account",
  staleMs: 15_000,
  fetch: (eventId: string, signal) => clientApi.events.statementOfAccount(eventId, { signal }),
});

/** Every event's statement at once, for the account-wide money view. Keyed by the event ids, comma-joined and sorted. */
export const clientStatementsOfAccount = defineResource({
  name: "client.statements-of-account",
  staleMs: 15_000,
  fetch: (eventIds: string, signal) =>
    Promise.all(eventIds.split(",").filter(Boolean).map((eventId) => clientApi.events.statementOfAccount(eventId, { signal }))),
});

export function statementsKey(eventIds: string[]): string {
  return [...eventIds].sort().join(",");
}
