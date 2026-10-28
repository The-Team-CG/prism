import { prismRequest } from "@prism/api-client";
import type { PrismSupplierQuoteForSupplier, PrismSupplierQuoteRequestTokenDetail, SubmitSupplierQuoteInput } from "@prism/types";

export const supplierQuoteLinkRepository = {
  read(token: string): Promise<PrismSupplierQuoteRequestTokenDetail> {
    return prismRequest<PrismSupplierQuoteRequestTokenDetail>(`/quote-requests/${encodeURIComponent(token)}`);
  },
  submit(token: string, input: SubmitSupplierQuoteInput): Promise<PrismSupplierQuoteForSupplier> {
    return prismRequest<PrismSupplierQuoteForSupplier>(`/quote-requests/${encodeURIComponent(token)}/quote`, { method: "POST", body: input });
  },
  revise(token: string, input: SubmitSupplierQuoteInput): Promise<PrismSupplierQuoteForSupplier> {
    return prismRequest<PrismSupplierQuoteForSupplier>(`/quote-requests/${encodeURIComponent(token)}/quote`, { method: "PATCH", body: input });
  },
};
