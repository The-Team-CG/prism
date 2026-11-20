import type { PrismSupplierReadinessItem } from "@prism/types";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "./supplier-workspace-types";

/** How a sent quote ended: still with PMCM, selected (a booking), not selected, or closed without a decision. */
export type QuoteOutcome = "pending" | "selected" | "not-selected" | "closed";

export function quoteOutcome(quote: Pick<PrismSupplierQuote, "status">, request?: Pick<PrismSupplierQuoteRequest, "status">): QuoteOutcome {
  if (["selected", "locked"].includes(quote.status)) return "selected";
  if (quote.status === "not_selected") return "not-selected";
  if (request && ["closed", "expired", "selected"].includes(request.status)) return "closed";
  return "pending";
}

export type QuoteHistoryRow = {
  quote: PrismSupplierQuote;
  request: PrismSupplierQuoteRequest | undefined;
  eventName: string;
  outcome: QuoteOutcome;
};

/**
 * Every quote the supplier sent, newest first, named by its event, with the counts the page leads with: how many
 * PMCM selected and what they are worth, how many wait on PMCM and how many were not selected.
 */
export function quoteHistory(quotes: PrismSupplierQuote[], requests: PrismSupplierQuoteRequest[], readiness: PrismSupplierReadinessItem[]) {
  const rows: QuoteHistoryRow[] = quotes
    .map((quote) => {
      const request = requests.find((item) => item.id === quote.requestId);
      const eventName = readiness.find((item) => item.requestId === quote.requestId)?.eventName
        || (request?.confidentialBid ? "Confidential event" : quote.category);
      return { quote, request, eventName, outcome: quoteOutcome(quote, request) };
    })
    .sort((a, b) => (b.quote.revisedAt ?? b.quote.createdAt).localeCompare(a.quote.revisedAt ?? a.quote.createdAt));
  const selected = rows.filter((row) => row.outcome === "selected");
  return {
    rows,
    selected: { count: selected.length, amount: selected.reduce((sum, row) => sum + row.quote.amount, 0) },
    pending: rows.filter((row) => row.outcome === "pending").length,
    notSelected: rows.filter((row) => row.outcome === "not-selected").length,
  };
}
