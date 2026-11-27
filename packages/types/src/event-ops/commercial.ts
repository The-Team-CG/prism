export interface PrismSupplierQuote {
  id: string;
  eventId: string;
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName: string;
  category: string;
  amount: number;
  inclusions: string[];
  paymentTerms: string;
  notes: string;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
  outsideAcceptableRange: boolean;
  status: string;
  revisionNumber?: number;
  revisedAt?: string | null;
  selectedAt?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PrismSupplierQuoteRoundComparison {
  id: string;
  eventId: string;
  category: string;
  roundNumber: number;
  status: string;
  bids: Array<{
    id: string;
    supplierId?: string | null;
    supplierName: string;
    amount: number;
    inclusions: string[];
    paymentTerms: string;
    notes: string;
    outsideAcceptableRange: boolean;
    status: string;
  }>;
}

export type PrismSupplierQuoteForSupplier = Omit<
  PrismSupplierQuote,
  "acceptableMin" | "acceptableMax" | "outsideAcceptableRange"
>;

export interface PrismSupplierQuoteRequestTokenDetail {
  request: Pick<PrismSupplierQuoteRequest, 'id' | 'category' | 'status' | 'dueDate' | 'message'>;
  quote: PrismSupplierQuoteForSupplier | null;
  eventId: string;
  eventName: string;
  clientName: string | null;
  eventDate: string | null;
  /** Scale and requirements for pricing; shown on confidential bids too, since they identify no client. */
  eventType: string;
  guestCount: number | null;
  /** Venue kind only; the venue name stays hidden on confidential bids. */
  venueType: string | null;
  serviceRequirements: string[];
}

export interface PrismSupplierSchedule {
  id: string;
  eventId: string;
  requestId: string;
  supplierName: string;
  ingressAt: string;
  egressAt: string;
  location: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrismSupplierDirectoryProfile {
  id: string;
  name: string;
  email?: string | null;
}

export interface PrismSupplierQuoteRequest {
  id: string;
  eventId: string;
  supplierId?: string;
  categoryId?: string;
  roundId?: string;
  roundNumber?: number;
  supplierName: string;
  category: string;
  message: string;
  dueDate?: string | null;
  accessToken: string;
  confidentialBid: boolean;
  status: string;
  assignmentStatus?: string;
  assignmentConfirmedAt?: string | null;
  readinessStatus?: string;
  readinessConfirmedAt?: string | null;
  readinessNotes?: string;
  eventDayStatus?: string;
  eventDayStatusAt?: string | null;
  eventDayNotes?: string;
  eventDayVerificationStatus?: string;
  eventDayVerifiedAt?: string | null;
  eventDayVerifiedBy?: string | null;
  eventDayVerificationNotes?: string;
  verificationStatus?: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  verificationNotes?: string;
  statusPhotoFileName?: string | null;
  contractDocumentId?: string | null;
  contractReviewStatus?: "missing" | "submitted" | "accepted" | "changes_requested";
  createdAt: string;
}

export type PrismSupplierTier =
  | "tier_1"
  | "tier_2"
  | "pending_first_event"
  | string;

/**
 * PMCM's internal supplier standing (UAT 8.1): Tier 1 is "Preferred"; Tier 2 splits on the BNI flag into
 * "BNI Preferred" and "Non-BNI Preferred"; a supplier without a completed event is a "New supplier".
 * Internal to PMCM: never show it in the supplier portal.
 */
export function supplierStandingLabel(tier: PrismSupplierTier, bniMember = false): string {
  if (tier === "tier_1") return "Preferred";
  if (tier === "tier_2") return bniMember ? "BNI Preferred" : "Non-BNI Preferred";
  if (tier === "pending_first_event") return "New supplier";
  return tier.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

/** The tiers PMCM sets on a supplier, labelled as standings; Tier 2's BNI split comes from the separate BNI flag. */
export const SUPPLIER_TIER_OPTIONS = [
  { value: "tier_1", label: "Preferred" },
  { value: "tier_2", label: "BNI / Non-BNI Preferred" },
  { value: "pending_first_event", label: "New supplier" },
] as const;

export interface PrismSupplierReviewDimension {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface PrismSupplierCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
  acceptableMin?: number | null;
  acceptableMax?: number | null;
  reviewDimensions: PrismSupplierReviewDimension[];
}

export interface PrismSupplierPastEvent {
  id: string;
  eventName: string;
  clientName: string;
  eventDate: string;
}

export interface PrismSupplierReviewDimensionRating {
  dimensionId: string;
  dimensionName: string;
  rating: number;
}

export interface PrismSupplierReview {
  id: string;
  rating: number;
  notes: string;
  reviewedBy: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
  dimensionRatings: PrismSupplierReviewDimensionRating[];
}

export interface PrismSupplierReliabilityNote {
  id: string;
  note: string;
  eventId?: string | null;
  eventName?: string | null;
  createdAt: string;
}

export interface PrismSupplierCertification {
  id: string;
  fileName: string;
  documentType?: string;
  issuer?: string;
  expiresAt?: string | null;
  status?: string;
  notes?: string;
  uploadedAt: string;
}

export interface PrismSupplier {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tier: PrismSupplierTier;
  bniMember: boolean;
  autoTrust: boolean;
  contactName: string;
  email: string;
  phone: string;
  serviceInclusions: string;
  performanceNotes: string;
  /** PMCM's capacity or scale rating; null while unrated. */
  capacityRating?: "small" | "medium" | "large" | null;
  applicationDate: string;
  aggregateRating: number | null;
  lastEventDate: string | null;
  pastEvents: PrismSupplierPastEvent[];
  reviews: PrismSupplierReview[];
  reliabilityNotes: PrismSupplierReliabilityNote[];
  certifications: PrismSupplierCertification[];
}

export type PrismSupplierApplicationStatus =
  | "pending"
  | "under_review"
  | "proposal_requested"
  | "meeting_scheduled"
  | "approved"
  | "declined";

export interface PrismSupplierApplication {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  categoryId: string | null;
  categoryName: string | null;
  pastEvents: string;
  serviceInclusions: string;
  certifications: string;
  priceRange: string;
  bniMember: boolean;
  portfolioUrl: string;
  additionalNotes: string;
  status: PrismSupplierApplicationStatus;
  declineReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface PrismSupplierApplicationStatusResult {
  id: string;
  companyName: string;
  status: PrismSupplierApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
}
