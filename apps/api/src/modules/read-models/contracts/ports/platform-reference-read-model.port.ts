import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const PLATFORM_REFERENCE_READ_MODEL = Symbol('PLATFORM_REFERENCE_READ_MODEL');

export type PlatformStorageEventScope = {
  id: string;
  archived: boolean;
  clientName: string;
  clientPortalStatus: string;
  clientEmail: string | null;
  supplierIds: string[];
  /** Persisted supplier identities booked on the event; storage resolves signed-in suppliers by these emails. */
  supplierContacts: Array<{ supplierId: string; email: string | null }>;
};

export type PareEventSource = {
  request: {
    id: string;
    eventId: string;
    assignmentStatus: string;
    supplierId: string | null;
    supplierName: string;
    category: string;
    supplierTier: string | null;
  };
  event: {
    id: string;
    eventDate: Date;
    eventName: string;
    clientName: string;
  };
  selectedQuotes: Array<{ requestId: string | null; amount: number | null }>;
  latestBriefingRequirements: unknown;
};

export type PareSupplierCandidateSource = {
  id: string;
  name: string;
  tier: string;
  serviceInclusions: string;
  performanceNotes: string;
  reviewRatings: number[];
  confirmedOnEvent: boolean;
  eventQuoteAmount: number | null;
};

export type PlatformPrivacyConsentFact = {
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
};

export type PlatformPrivacyEventInventory = {
  id: string;
  eventName: string;
  clientName: string;
  inquiryId: string;
  eventDate: Date;
  inquiry: PlatformPrivacyConsentFact | null;
  guestCheckIns: PlatformPrivacyConsentFact[];
  guestFeedback: PlatformPrivacyConsentFact[];
  guestRosterEntryCount: number;
  guestFeedbackMedia: PlatformPrivacyConsentFact[];
};

export type PlatformPrivacyInventory = {
  events: PlatformPrivacyEventInventory[];
  approvalRequests: PlatformPrivacyConsentFact[];
};

/** Narrow, read-only owner composition used by Platform event, privacy, AI, and identity-evidence flows. */
export interface PlatformReferenceReadModel {
  findStorageEventScope(eventId: string, transaction?: PrismTransactionContext): Promise<PlatformStorageEventScope | null>;
  /** PMCM visibility overrides keyed by file requirement key; keys without an override are absent. */
  findFileRequirementVisibility(eventId: string): Promise<Record<string, string[]>>;
  findEventReference(eventId: string): Promise<{ id: string } | null>;
  findPrivacyInventory(input?: { eventId?: string }): Promise<PlatformPrivacyInventory>;
  findPareEventSource(requestId: string): Promise<PareEventSource | null>;
  findPareSupplierCandidates(input: { category: string; withdrawnSupplierId: string; withdrawnSupplierName: string; eventId: string }): Promise<PareSupplierCandidateSource[]>;
  findApprovedTrustRecipientEmail(): Promise<string | null>;
  /** Approved, non-locked PMCM administrator by user id; used to validate privacy request assignees. */
  findApprovedPmcmOperator(userId: string): Promise<{ id: string; name: string } | null>;
}
