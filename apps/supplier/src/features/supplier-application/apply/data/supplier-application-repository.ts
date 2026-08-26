import { prismApi } from "@/lib/prism-api";
import type { CreateSupplierApplicationInput, PrismSupplierApplication } from "@prism/types";

export const supplierApplicationRepository = {
  create(input: CreateSupplierApplicationInput): Promise<PrismSupplierApplication> {
    return prismApi.createSupplierApplication(input);
  },

  listCategories(): Promise<{ id: string; name: string }[]> {
    return prismApi.listSupplierCategories();
  },
};
