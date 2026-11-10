import type {
  PmcmSupplierDirectoryQuery,
  PmcmSupplierHistoryQuery,
  PmcmSupplierProfileQuery,
  PmcmSupplierRecordsQuery,
  PrismPmcmSupplierCertificationsPage,
  PrismPmcmSupplierDirectoryPage,
  PrismPmcmSupplierEngagement,
  PrismPmcmSupplierPage,
  PrismPmcmSupplierProfile,
  PrismPmcmSupplierRecordsPage,
  PrismPmcmSupplierReviewsPage,
  PrismSupplierCategory,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const supplierDirectoryRepository = {
  listCategories(signal?: AbortSignal): Promise<PrismSupplierCategory[]> {
    return eventApi.commercial.supplierCategories({ signal });
  },
  listDirectory(query: PmcmSupplierDirectoryQuery, signal?: AbortSignal): Promise<PrismPmcmSupplierDirectoryPage> {
    return eventApi.commercial.supplierDirectory(query, { signal });
  },
  getProfile(supplierId: string, query: PmcmSupplierProfileQuery, signal?: AbortSignal): Promise<PrismPmcmSupplierProfile> {
    return eventApi.commercial.supplierProfile(supplierId, query, { signal });
  },
  listReviews(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal): Promise<PrismPmcmSupplierReviewsPage> {
    return eventApi.commercial.supplierReviews(supplierId, query, { signal });
  },
  listCertifications(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal): Promise<PrismPmcmSupplierCertificationsPage> {
    return eventApi.commercial.supplierCertifications(supplierId, query, { signal });
  },
  listRecords(supplierId: string, query: PmcmSupplierRecordsQuery, signal?: AbortSignal): Promise<PrismPmcmSupplierRecordsPage> {
    return eventApi.commercial.supplierRecords(supplierId, query, { signal });
  },
  listEngagements(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal): Promise<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>> {
    return eventApi.commercial.supplierEngagements(supplierId, query, { signal });
  },
};
