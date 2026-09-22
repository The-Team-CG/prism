import {
  parseContract,
  supplierApplicationStatusQuerySchema,
  type PrismSupplierApplicationStatusResult,
  type SupplierApplicationStatusQuery,
} from "@prism/types";
import { supplierApplicationStatusRepository } from "../data/supplier-application-status-repository";

export function getSupplierApplicationStatus(
  input: SupplierApplicationStatusQuery,
  signal?: AbortSignal,
): Promise<PrismSupplierApplicationStatusResult> {
  const query = parseContract(supplierApplicationStatusQuerySchema, input, "Application status lookup");
  return supplierApplicationStatusRepository.getStatus(query, signal);
}
