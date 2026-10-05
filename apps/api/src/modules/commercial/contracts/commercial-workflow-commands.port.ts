import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type {
  AddSupplierQuoteInput,
  PrismSupplierQuote,
  PrismSupplierQuoteForSupplier,
  PrismSupplierQuoteRequest,
  RequestSupplierQuotesInput,
  SubmitSupplierQuoteInput,
} from '@prism/types';

export interface CommercialWorkflowCommands {
  requestSupplierQuotes(eventId: string, input: RequestSupplierQuotesInput, actor: ResolvedEventOpsActor): Promise<PrismSupplierQuoteRequest[]>;
  addSupplierQuote(eventId: string, input: AddSupplierQuoteInput, actor: ResolvedEventOpsActor): Promise<PrismSupplierQuote>;
  submitSupplierQuoteByToken(token: string, input: SubmitSupplierQuoteInput): Promise<PrismSupplierQuoteForSupplier>;
  reviseSupplierQuoteByToken(token: string, input: Partial<SubmitSupplierQuoteInput>): Promise<PrismSupplierQuoteForSupplier>;
  selectSupplierQuote(eventId: string, quoteId: string, actor: ResolvedEventOpsActor): Promise<PrismSupplierQuote>;
}
