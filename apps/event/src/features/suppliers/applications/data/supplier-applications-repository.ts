import { defineResource } from "@prism/portal-query";
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

/** The applications waiting for PMCM, for the count on the directory's banner. */
export const supplierApplicationsInbox = defineResource({
  name: "pmcm.supplier-applications",
  staleMs: 60_000,
  fetch: (_actor: "signed-in") => eventApi.supplierApplications.listInbox(),
});
