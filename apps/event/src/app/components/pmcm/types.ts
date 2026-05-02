import type { MvpSupplier, MvpSupplierQuoteRequest, MvpUser } from "@/lib/mvp-api";

export type PmcmEventSession = MvpUser & { signedInAt: string };

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

export type SupplierQuoteRequestRow = MvpSupplierQuoteRequest;

export type SupplierRequestHandler = (input: {
  categoryId: string;
  supplierIds: string[];
  confidentialBid: boolean;
  deadline?: string;
}) => Promise<void>;

export type SupplierQuoteSelectHandler = (quoteId: string) => Promise<void>;
