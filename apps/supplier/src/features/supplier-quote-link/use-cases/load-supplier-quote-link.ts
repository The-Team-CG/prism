import { supplierQuoteLinkRepository } from "../data/supplier-quote-link-repository";

export const loadSupplierQuoteLink = (token: string) => supplierQuoteLinkRepository.read(token);
