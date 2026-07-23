import { prismApi, type CreateSupplierApplicationInput } from "@/lib/prism-api";
import type { PrismSupplierApplication } from "@prism/types";

export const supplierApplicationRepository = {
  create(input: CreateSupplierApplicationInput): Promise<PrismSupplierApplication> {
    return prismApi.createSupplierApplication(input);
  },

  listCategories(): Promise<{ id: string; name: string }[]> {
    return prismApi.listSupplierCategories();
  },
};
