import { addSupplierQuoteSchema, parseContract, type AddSupplierQuoteInput } from "@prism/types";
import type { SupplierQuoteRequestRow } from "@/features/pmcm-kit";
import { loggedQuoteInput, type LoggedQuoteDraft } from "../model/suppliers-directory-rules";

/** Checks a quote PMCM types in from a phone call or email before it is sent; the amount must be whole pesos. */
export function loggedSupplierQuote(request: SupplierQuoteRequestRow, draft: LoggedQuoteDraft): AddSupplierQuoteInput {
  const input = loggedQuoteInput(request, draft);
  if (Number.isNaN(input.amount)) throw new Error("Enter the quoted amount in whole pesos, for example 45,000.");
  return parseContract(addSupplierQuoteSchema, input, "Supplier quote");
}
