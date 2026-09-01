// This module previously duplicated mapSupplierQuoteRequest byte-for-byte
// with ../quotes/supplier-quote.mappers.ts (former commercial-ops and
// supplier-ops each had their own copy). Consolidated into the commercial
// bounded context (2026-09-01): both former callers now share the single
// implementation in ../quotes/supplier-quote.mappers.ts.
export { mapSupplierQuoteRequest } from '../quotes/supplier-quote.mappers';
