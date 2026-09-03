import type { SupplierQuoteRequestRow, SupplierQuoteRow } from "@/features/pmcm-kit";

export type PmcmSupplierReadinessRow = {
  id: string;
  supplierName: string;
  category: string;
  quoteStatus: string;
  assignmentStatus: string;
  readinessStatus: string;
  locked: boolean;
};

function quoteForRequest(quotes: SupplierQuoteRow[], request: SupplierQuoteRequestRow) {
  return quotes.find((quote) => quote.requestId === request.id);
}

export function isLockedQuoteStatus(status?: string) {
  return status === "selected" || status === "locked";
}

export function pmcmSupplierReadinessRows(
  requests: SupplierQuoteRequestRow[],
  quotes: SupplierQuoteRow[],
): PmcmSupplierReadinessRow[] {
  return requests.map((request) => {
    const quote = quoteForRequest(quotes, request);
    return {
      id: request.id,
      supplierName: request.supplierName,
      category: request.category,
      quoteStatus: quote?.status ?? "awaiting_quote",
      assignmentStatus: request.assignmentStatus ?? "unassigned",
      readinessStatus: request.readinessStatus ?? "not_confirmed",
      locked: isLockedQuoteStatus(quote?.status),
    };
  });
}
