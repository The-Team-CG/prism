import type { OpsSupplierQuote, OpsSupplierQuoteRequest } from '@prisma/client';
import type { RequestSupplierQuotesInput, SubmitSupplierQuoteInput } from '../services/commercial-workflow.service';

export type AddSupplierQuoteInput = {
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName?: string;
  category?: string;
  amount?: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
  status?: string;
};

export interface CommercialWorkflowCommands {
  requestSupplierQuotes(eventId: string, input: RequestSupplierQuotesInput): Promise<OpsSupplierQuoteRequest[]>;
  addSupplierQuote(eventId: string, input: AddSupplierQuoteInput): Promise<OpsSupplierQuote>;
  submitSupplierQuoteByToken(token: string, input: SubmitSupplierQuoteInput): Promise<OpsSupplierQuote>;
  reviseSupplierQuoteByToken(token: string, input: Partial<SubmitSupplierQuoteInput>): Promise<OpsSupplierQuote>;
  selectSupplierQuote(eventId: string, quoteId: string, actorName?: string): Promise<OpsSupplierQuote>;
}