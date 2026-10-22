import type {
  PrismPmcmSupplierCertificationsPage,
  PrismPmcmSupplierDirectoryPage,
  PrismPmcmSupplierEngagementFactsPage,
  PrismPmcmSupplierProfile,
  PrismPmcmSupplierRecordsPage,
  PrismPmcmSupplierReviewsPage,
} from '@prism/types';
import type {
  PmcmSupplierDirectoryQuery,
  PmcmSupplierHistoryQuery,
  PmcmSupplierProfileQuery,
  PmcmSupplierRecordsQuery,
} from '@prism/types';

export interface SupplierWorkspaceReader {
  listDirectory(query: PmcmSupplierDirectoryQuery): Promise<PrismPmcmSupplierDirectoryPage>;
  getProfile(supplierId: string, query: PmcmSupplierProfileQuery): Promise<PrismPmcmSupplierProfile>;
  listReviews(supplierId: string, query: PmcmSupplierHistoryQuery): Promise<PrismPmcmSupplierReviewsPage>;
  listCertifications(supplierId: string, query: PmcmSupplierHistoryQuery): Promise<PrismPmcmSupplierCertificationsPage>;
  listRecords(supplierId: string, query: PmcmSupplierRecordsQuery): Promise<PrismPmcmSupplierRecordsPage>;
  listEngagementFacts(supplierId: string, query: PmcmSupplierHistoryQuery): Promise<PrismPmcmSupplierEngagementFactsPage>;
}
