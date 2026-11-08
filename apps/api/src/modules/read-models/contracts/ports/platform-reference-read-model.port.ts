import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const PLATFORM_REFERENCE_READ_MODEL = Symbol('PLATFORM_REFERENCE_READ_MODEL');

/** Persisted event facts the file-access scope resolves against (assignments and quote requests with status). */
export type PlatformStorageEventScope = {
  id: string;
  archived: boolean;
  clientName: string;
  clientPortalStatus: string;
  clientEmail: string | null;
  coordinatorAssignments: ReadonlyArray<{
    coordinatorId: string | null;
    coordinator: { userId: string | null; email: string | null } | null;
  }>;
  supplierQuoteRequests: ReadonlyArray<{
    supplierId: string | null;
    status: string;
    supplier: { email: string | null } | null;
  }>;
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

/** Inquiry facts the AI triage use case may read. Contact identity is deliberately absent. */
export type AiInquiryTriageSource = {
  id: string;
  status: string;
  eventType: string;
  clientType: string;
  eventDate: Date;
  hasOrganization: boolean;
  source: string;
  referralDetails: string;
  message: string;
  duplicateInquiryCount: number;
  previouslyDeclined: boolean;
};

/** Event facts the AI proposal drafting use case may read. Client identity is deliberately absent. */
export type AiProposalEventSource = {
  id: string;
  eventName: string;
  eventType: string;
  eventDate: Date;
  archived: boolean;
  clientPortalStatus: string;
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
  /** Document types that bind the given stored objects to a file requirement; a binding names the requirement key. */
  findStoredObjectRequirementBindings(eventId: string, objectIds: readonly string[]): Promise<Array<{ objectId: string; documentType: string }>>;
  findEventReference(eventId: string): Promise<{ id: string } | null>;
  findPrivacyInventory(input?: { eventId?: string }): Promise<PlatformPrivacyInventory>;
  findPareEventSource(requestId: string): Promise<PareEventSource | null>;
  findPareSupplierCandidates(input: { category: string; withdrawnSupplierId: string; withdrawnSupplierName: string; eventId: string }): Promise<PareSupplierCandidateSource[]>;
  findInquiryTriageSource(inquiryId: string): Promise<AiInquiryTriageSource | null>;
  findProposalDraftEventSource(eventId: string): Promise<AiProposalEventSource | null>;
  findApprovedTrustRecipientEmail(): Promise<string | null>;
  /** Approved, non-locked PMCM administrator by user id; used to validate privacy request assignees. */
  findApprovedPmcmOperator(userId: string): Promise<{ id: string; name: string } | null>;
}
