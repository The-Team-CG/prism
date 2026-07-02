import type { PrismSupplier, PrismSupplierQuoteRequest } from "@/lib/prism-api";
import type { PrismAuthenticatedSession } from "@prism/types";

export type PmcmEventSession = PrismAuthenticatedSession;

export type SupplierQuoteRow = {
  id: string;
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName: string;
  category: string;
  amount: number;
  inclusions: string[];
  paymentTerms: string;
  notes: string;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
  outsideAcceptableRange: boolean;
  status: string;
  selectedAt?: string | null;
  createdAt: string;
};

export type SupplierQuoteRequestRow = PrismSupplierQuoteRequest;

export type SupplierRequestHandler = (input: {
  categoryId: string;
  supplierIds: string[];
  confidentialBid: boolean;
  deadline?: string;
}) => Promise<void>;

export type SupplierQuoteSelectHandler = (quoteId: string) => Promise<void>;
