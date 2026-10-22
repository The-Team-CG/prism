import type {
  PrismSupplier,
  PrismSupplierCertification,
  PrismSupplierReview,
  PrismSupplierReviewDimension,
} from "./commercial.js";
import type {
  PmcmSupplierDirectoryQuery,
  PmcmSupplierProfileQuery,
  PmcmSupplierRecordsQuery,
} from "../schemas/commercial-supplier-read-inputs.js";

export interface PrismPmcmSupplierPage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export type PrismPmcmSupplierCertificationAttention =
  | "rejected"
  | "expired"
  | "submitted"
  | "unknown"
  | "verified"
  | "none";

export interface PrismPmcmSupplierCertificationSummary {
  rejected: number;
  expired: number;
  submitted: number;
  verified: number;
  unknown: number;
  attention: PrismPmcmSupplierCertificationAttention;
}

export interface PrismPmcmSupplierDirectoryRow {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tier: string;
  bniMember: boolean;
  contactName: string;
  email: string;
  phone: string;
  rating: { average: number | null; count: number };
  lastReviewedAt: string | null;
  certifications: PrismPmcmSupplierCertificationSummary;
}

export interface PrismPmcmSupplierDirectoryPage extends PrismPmcmSupplierPage<PrismPmcmSupplierDirectoryRow> {
  query: PmcmSupplierDirectoryQuery;
  asOf: string;
}

export interface PrismPmcmSupplierScorecard {
  dimensionId: string;
  dimensionName: string;
  average: number | null;
  sampleCount: number;
  latest: { rating: number; reviewedBy: string; createdAt: string } | null;
}

export interface PrismPmcmSupplierProfile {
  supplier: Pick<
    PrismSupplier,
    | "id"
    | "name"
    | "categoryId"
    | "categoryName"
    | "categorySlug"
    | "tier"
    | "bniMember"
    | "contactName"
    | "email"
    | "phone"
    | "serviceInclusions"
    | "performanceNotes"
    | "applicationDate"
  >;
  rating: { average: number | null; count: number };
  lastReviewedAt: string | null;
  certifications: PrismPmcmSupplierCertificationSummary;
  reviewDimensions: PrismSupplierReviewDimension[];
  scorecards: PrismPmcmSupplierScorecard[];
  period: PmcmSupplierProfileQuery["period"];
  asOf: string;
}

export interface PrismPmcmSupplierRecord {
  id: string;
  kind: "review" | "reliability_note" | "certification";
  occurredAt: string;
  text: string;
  actorName: string | null;
  eventId: string | null;
}

export interface PrismPmcmSupplierRecordsPage extends PrismPmcmSupplierPage<PrismPmcmSupplierRecord> {
  period: PmcmSupplierRecordsQuery["period"];
  asOf: string;
  chartStartDate: string;
  chartEndDate: string;
  counts: { reviews: number; reliabilityNotes: number; certifications: number; total: number };
  dailyBuckets: Array<{ date: string; count: number }>;
}

export interface PrismPmcmSupplierEngagementFacts {
  eventId: string;
  lastRequestAt: string;
  hasConfirmedAssignment: boolean;
  hasAssessment: boolean;
  requests: Array<{
    id: string;
    category: string;
    status: string;
    assignmentStatus: string;
    readinessStatus: string;
    eventDayStatus: string;
  }>;
  requestCount: number;
  hasMoreRequests: boolean;
}

export interface PrismPmcmSupplierEngagementFactsPage extends PrismPmcmSupplierPage<PrismPmcmSupplierEngagementFacts> {
  supplierTier: string;
}

export interface PrismPmcmSupplierEngagement extends PrismPmcmSupplierEngagementFacts {
  event: { id: string; name: string; date: string; status: string };
  canReview: boolean;
  canPromote: boolean;
}

export interface PrismPmcmSupplierReviewsPage extends PrismPmcmSupplierPage<PrismSupplierReview> {}

export interface PrismPmcmSupplierCertificationsPage extends PrismPmcmSupplierPage<PrismSupplierCertification> {}
