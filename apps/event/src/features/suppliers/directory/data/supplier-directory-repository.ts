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
import { eventApiRequest } from "@/lib/prism-api";

function queryString(values: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function supplierPath(supplierId: string, resource: string) {
  return `/api/suppliers/${encodeURIComponent(supplierId)}/${resource}`;
}

export const supplierDirectoryRepository = {
  listCategories(signal?: AbortSignal) {
    return eventApiRequest<PrismSupplierCategory[]>("/api/suppliers/categories", { signal });
  },
  listDirectory(query: PmcmSupplierDirectoryQuery, signal?: AbortSignal) {
    return eventApiRequest<PrismPmcmSupplierDirectoryPage>(`/api/suppliers/directory${queryString(query)}`, { signal });
  },
  getProfile(supplierId: string, query: PmcmSupplierProfileQuery, signal?: AbortSignal) {
    return eventApiRequest<PrismPmcmSupplierProfile>(`${supplierPath(supplierId, "profile")}${queryString(query)}`, { signal });
  },
  listReviews(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal) {
    return eventApiRequest<PrismPmcmSupplierReviewsPage>(`${supplierPath(supplierId, "reviews")}${queryString(query)}`, { signal });
  },
  listCertifications(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal) {
    return eventApiRequest<PrismPmcmSupplierCertificationsPage>(`${supplierPath(supplierId, "certifications")}${queryString(query)}`, { signal });
  },
  listRecords(supplierId: string, query: PmcmSupplierRecordsQuery, signal?: AbortSignal) {
    return eventApiRequest<PrismPmcmSupplierRecordsPage>(`${supplierPath(supplierId, "records")}${queryString(query)}`, { signal });
  },
  listEngagements(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal) {
    return eventApiRequest<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>>(
      `/api/pmcm/suppliers/${encodeURIComponent(supplierId)}/engagements${queryString(query)}`,
      { signal },
    );
  },
};
