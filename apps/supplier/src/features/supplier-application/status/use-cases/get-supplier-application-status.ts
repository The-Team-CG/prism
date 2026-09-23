import {
  parseContract,
  PrismContractError,
  supplierApplicationStatusQuerySchema,
  type PrismSupplierApplicationStatusResult,
  type SupplierApplicationStatusQuery,
} from "@prism/types";
import { supplierApplicationStatusRepository } from "../data/supplier-application-status-repository";
import { SupplierApplicationStatusLookupFailureError } from "../model/supplier-application-status-rules";

export function getSupplierApplicationStatus(
  input: SupplierApplicationStatusQuery,
  signal?: AbortSignal,
): Promise<PrismSupplierApplicationStatusResult> {
  let query: SupplierApplicationStatusQuery;
  try {
    query = parseContract(supplierApplicationStatusQuerySchema, input, "Application status lookup");
  } catch (error) {
    if (error instanceof PrismContractError) {
      throw new SupplierApplicationStatusLookupFailureError("invalid_input");
    }
    throw error;
  }
  return supplierApplicationStatusRepository.getStatus(query, signal);
}
