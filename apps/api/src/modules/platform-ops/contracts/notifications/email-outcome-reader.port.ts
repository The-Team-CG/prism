export const EMAIL_OUTCOME_READER = Symbol('EMAIL_OUTCOME_READER');
export interface EmailOutcomeReader {
  retrieve(receipt: string): Promise<string>;
}
