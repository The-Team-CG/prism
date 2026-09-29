import { eventApi } from "@/lib/prism-api";
import type { PrismSupplierApplication, ReviewSupplierApplicationInput } from "@prism/types";

export const supplierApplicationsRepository = {
  listInbox(): Promise<PrismSupplierApplication[]> {
    return eventApi.supplierApplications.listInbox();
  },
  review(applicationId: string, input: ReviewSupplierApplicationInput): Promise<PrismSupplierApplication> {
    return eventApi.supplierApplications.review(applicationId, input);
  },
};
