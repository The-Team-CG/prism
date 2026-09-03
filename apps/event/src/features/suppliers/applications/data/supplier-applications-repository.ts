import { prismApi } from "@/lib/prism-api";
import type { PrismSupplierApplication, ReviewSupplierApplicationInput } from "@prism/types";

export const supplierApplicationsRepository = {
  listInbox(): Promise<PrismSupplierApplication[]> {
    return prismApi.listSupplierApplications();
  },
  review(applicationId: string, input: ReviewSupplierApplicationInput): Promise<PrismSupplierApplication> {
    return prismApi.reviewSupplierApplication(applicationId, input);
  },
};
