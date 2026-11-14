import { getStorageObjectDownload } from "@prism/api-client";
import { defineResource } from "@prism/portal-query";
import { eventApi, storedEventAccessToken } from "@/lib/prism-api";

/** One event's statement of account as PMCM sees it: each payment with what is still being verified or disputed. */
export const eventStatementOfAccount = defineResource({
  name: "finance.event-statement-of-account",
  staleMs: 10_000,
  fetch: (eventId: string, signal) => eventApi.events.statementOfAccount(eventId, { signal }),
});

/** The stored billing statement PDF, fetched through storage like every other file. */
export function downloadStatementPdf(storageObjectId: string) {
  return getStorageObjectDownload(storageObjectId, { authToken: storedEventAccessToken() });
}
