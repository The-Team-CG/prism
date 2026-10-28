import { parseContract, submitSupplierQuoteSchema, type SubmitSupplierQuoteInput } from "@prism/types";
import { supplierQuoteLinkRepository } from "../data/supplier-quote-link-repository";

export function saveSupplierQuote(token: string, hasExistingQuote: boolean, input: SubmitSupplierQuoteInput) {
  if (input.amount <= 0) throw new Error("Quote amount must be greater than zero.");
  const parsed = parseContract(submitSupplierQuoteSchema, input, "Supplier quote");
  return hasExistingQuote
    ? supplierQuoteLinkRepository.revise(token, parsed)
    : supplierQuoteLinkRepository.submit(token, parsed);
}
