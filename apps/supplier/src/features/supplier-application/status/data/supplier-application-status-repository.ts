import { PrismApiError } from "@prism/api-client";
import type { PrismSupplierApplicationStatusResult, SupplierApplicationStatusQuery } from "@prism/types";
import { prismApi } from "@/lib/prism-api";
import {
  isAbortError,
  SupplierApplicationStatusLookupFailureError,
  type SupplierApplicationStatusFailure,
} from "../model/supplier-application-status-rules";

export function normalizeSupplierApplicationStatusRequestError(
  error: unknown,
): SupplierApplicationStatusLookupFailureError {
  const failure: SupplierApplicationStatusFailure =
    error instanceof PrismApiError && error.status === 404 ? "not_found" : "unavailable";
  return new SupplierApplicationStatusLookupFailureError(failure);
}

export const supplierApplicationStatusRepository = {
  getStatus(
    input: SupplierApplicationStatusQuery,
    signal?: AbortSignal,
  ): Promise<PrismSupplierApplicationStatusResult> {
    return prismApi.getSupplierApplicationStatus(input, signal).catch((error: unknown) => {
      if (isAbortError(error)) throw error;
      throw normalizeSupplierApplicationStatusRequestError(error);
    });
  },
};
