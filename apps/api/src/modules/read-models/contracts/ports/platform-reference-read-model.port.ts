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

/** Facts behind the FR-AI-09 client message triggers. The client email is for delivery only, never for the model. */
export type ClientMessageTriggerFacts = {
  event: AiProposalEventSource & { proposalClientStatus: string; floorPlanStatus: string; floorPlanSubmittedAt: Date | null; clientEmail: string };
  latestIssuedProposal: { versionNumber: number; issuedAt: Date } | null;
  nextUnpaidMilestone: { label: string; remainingBalance: number; dueDate: Date } | null;
};

/** Facts for the event-scoped AI advisories (FR-10+, FR-11, FR-AI-08). No client identity. */
export type AiAdvisoryFacts = {
  event: { eventType: string; eventDate: Date; status: string };
  briefing: { guestCount: number; venueType: string | null; moodAndStyling: string; budgetRange: string; stylingBudget: number | null } | null;
  openChecks: Array<{ title: string; severity: string; evidence: unknown; remediation: string }>;
  insight: { dimensions: unknown; risks: unknown; supplierNotes: unknown; financialSummary: unknown } | null;
  checkedInGuests: number;
  clientRating: number | null;
};

/** FR-AI-07: one event's live state, as raw facts; the AI service reduces them before any model call. */
export type EventDayCopilotFacts = {
  eventType: string;
  operatorCoordinatorIds: string[];
  suppliers: Array<{ category: string; eventDayStatus: string; ingressAt: Date | null }>;
  openTasks: Array<{ title: string; priority: string; assignedRole: string; dueAt: Date | null }>;
  attendance: Array<{ attendanceStatus: string }>;
  checkedIn: number;
  checkedInLastHour: number;
  expectedGuests: number | null;
  openIssues: Array<{ title: string; severity: string; createdAt: Date; slaDueAt: Date | null }>;
};

/** FR-AI-05: counts and statuses for one event; no names, contacts or amounts per party. */
export type OperationsAssistantFacts = {
  eventType: string;
  eventDate: Date;
  phase: string;
  guestCount: number | null;
  proposalStatus: string;
  floorPlanStatus: string;
  suppliersRequested: number;
  suppliersConfirmed: number;
  openTasks: number;
  overdueTasks: number;
  openIssues: number;
  openComplianceItems: number;
  outstandingBalance: number;
  checkedInGuests: number;
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
  /** New-SEC2 finance category: client billing copies and recorded payments. */
  billingStatementCount: number;
  paymentRecordCount: number;
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
  supplierMayUploadRequirement(eventId: string, key: string, supplierId: string): Promise<boolean>;
  /** Document types that bind the given stored objects to a file requirement; a binding names the requirement key. */
  findStoredObjectRequirementBindings(eventId: string, objectIds: readonly string[]): Promise<Array<{ objectId: string; documentType: string }>>;
  findEventReference(eventId: string): Promise<{ id: string } | null>;
  findPrivacyInventory(input?: { eventId?: string }): Promise<PlatformPrivacyInventory>;
  findPareEventSource(requestId: string): Promise<PareEventSource | null>;
  findPareSupplierCandidates(input: { category: string; withdrawnSupplierId: string; withdrawnSupplierName: string; eventId: string }): Promise<PareSupplierCandidateSource[]>;
  findInquiryTriageSource(inquiryId: string): Promise<AiInquiryTriageSource | null>;
  findProposalDraftEventSource(eventId: string): Promise<AiProposalEventSource | null>;
  findClientMessageTriggerFacts(eventId: string): Promise<ClientMessageTriggerFacts | null>;
  findAiAdvisoryFacts(eventId: string): Promise<AiAdvisoryFacts | null>;
  findEventDayCopilotFacts(eventId: string, now: Date): Promise<EventDayCopilotFacts | null>;
  findOperationsAssistantFacts(eventId: string, now: Date): Promise<OperationsAssistantFacts | null>;
  findApprovedTrustRecipientEmail(): Promise<string | null>;
  /** Approved, non-locked PMCM administrator by user id; used to validate privacy request assignees. */
  findApprovedPmcmOperator(userId: string): Promise<{ id: string; name: string } | null>;
}
