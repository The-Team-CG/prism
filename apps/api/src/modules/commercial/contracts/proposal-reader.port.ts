import type { QuoteRequestTokenDetail } from '../application/quotes/commercial-workflow.service';

export interface ProposalReader {
  getQuoteRequestByToken(token: string): Promise<QuoteRequestTokenDetail>;
}
