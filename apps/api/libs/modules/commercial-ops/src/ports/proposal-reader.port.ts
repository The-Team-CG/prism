import type { QuoteRequestTokenDetail } from '../services/commercial-workflow.service';

export interface ProposalReader {
  getQuoteRequestByToken(token: string): Promise<QuoteRequestTokenDetail>;
}