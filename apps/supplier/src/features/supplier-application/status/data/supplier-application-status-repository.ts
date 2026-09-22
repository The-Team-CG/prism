import type { PrismSupplierApplicationStatusResult, SupplierApplicationStatusQuery } from "@prism/types";
import { prismApi } from "@/lib/prism-api";

export const supplierApplicationStatusRepository = {
  getStatus(
    input: SupplierApplicationStatusQuery,
    signal?: AbortSignal,
  ): Promise<PrismSupplierApplicationStatusResult> {
    return prismApi.getSupplierApplicationStatus(input, signal);
  },
};
