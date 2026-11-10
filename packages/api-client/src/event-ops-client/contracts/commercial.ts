import type {
  AcknowledgeSupplierGapInput,
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
  PrismSupplierGap,
  PrismSupplierSchedule,
  ClientMessageDraftRequest,
  CommsDraftResult,
  CreateClientReviewItemInput,
  CreateCostEstimateInput,
  CreateProposalCommentInput,
  IssueProposalVersionInput,
  PrismClientMessageTriggerState,
  PrismClientReviewItem,
  PrismCostEstimate,
  PrismEstimateLineSource,
  PrismEventProposalResponse,
  PrismPreviousCostEstimate,
  PrismProposalComment,
  PrismProposalVersion,
  ProposalDraftRequest,
  ProposalDraftResponse,
  SendClientMessageInput,
  ChangeSupplierTierInput,
  CreateAdditionalBillingInput,
  CreateBillingDisputeInput,
  PrismAdditionalBilling,
  PrismBillingCorrection,
  PrismBillingDispute,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  ResolveBillingDisputeInput,
  WaiveAdditionalBillingInput,
  CreateBillingSourceInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReliabilityNoteInput,
  CreateSupplierReviewInput,
  MarkPaymentInput,
  PromoteSupplierInput,
  PrismBillingSource,
  PrismBillingStatement,
  PrismPaymentMilestone,
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierQuoteRoundComparison,
  RecordPaymentInput,
  RequestSupplierQuotesInput,
  SupplierAvailabilityInput,
  UpdateSupplierInput,
  VerifySupplierStatusInput,
} from "@prism/types";
import type { EventOpsActorQuery, EventOpsReadInit } from "./primitives";

/** Billing, payments, supplier records and quote requests: the PMCM commercial commands. */
export interface EventOpsCommercialContract {
  commercial: {
    createBillingSource(eventId: string, input: CreateBillingSourceInput, actor?: EventOpsActorQuery): Promise<PrismBillingSource>;
    approveBillingSource(eventId: string, sourceId: string, approvalNotes?: string, actor?: EventOpsActorQuery): Promise<PrismBillingSource>;
    generateBillingStatement(eventId: string, sourceId?: string, actor?: EventOpsActorQuery): Promise<PrismBillingStatement>;
    sendBillingStatement(eventId: string, billingId: string, actor?: EventOpsActorQuery): Promise<PrismBillingStatement>;
    createBillingDispute(eventId: string, input: CreateBillingDisputeInput, actor?: EventOpsActorQuery): Promise<PrismBillingDispute>;
    resolveBillingDispute(eventId: string, disputeId: string, input: ResolveBillingDisputeInput, actor?: EventOpsActorQuery): Promise<PrismBillingDispute>;
    requestBillingCorrection(eventId: string, input: RequestBillingCorrectionInput, actor?: EventOpsActorQuery): Promise<PrismBillingCorrection>;
    resolveBillingCorrection(eventId: string, correctionId: string, input: ResolveBillingCorrectionInput, actor?: EventOpsActorQuery): Promise<PrismBillingCorrection>;
    createAdditionalBilling(eventId: string, input: CreateAdditionalBillingInput, actor?: EventOpsActorQuery): Promise<PrismAdditionalBilling>;
    waiveAdditionalBilling(eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput, actor?: EventOpsActorQuery): Promise<PrismAdditionalBilling>;
    recordPayment(eventId: string, milestoneId: string, input: RecordPaymentInput, actor?: EventOpsActorQuery): Promise<PrismPaymentMilestone>;
    markPayment(eventId: string, milestoneId: string, input: MarkPaymentInput, actor?: EventOpsActorQuery): Promise<PrismPaymentMilestone>;
    createSupplier(input: CreateSupplierInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    updateSupplier(supplierId: string, input: UpdateSupplierInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    promoteSupplier(supplierId: string, input: PromoteSupplierInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    addSupplierCertification(supplierId: string, input: CreateSupplierCertificationInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    addSupplierReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actor?: EventOpsActorQuery): Promise<PrismSupplier>;
    setSupplierAvailability(supplierId: string, input: SupplierAvailabilityInput, actor?: EventOpsActorQuery): Promise<{ id: string }>;
    requestSupplierQuotes(eventId: string, input: RequestSupplierQuotesInput, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest[]>;
    withdrawQuoteRequest(eventId: string, requestId: string, actor?: EventOpsActorQuery): Promise<{ ok: boolean }>;
    compareQuoteRound(eventId: string, roundId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRoundComparison>;
    verifySupplierStatus(eventId: string, requestId: string, input: VerifySupplierStatusInput, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest>;
    selectSupplierQuote(eventId: string, quoteId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierQuote>;
    proposal(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventProposalResponse>;
    createCostEstimate(eventId: string, input: CreateCostEstimateInput, actor?: EventOpsActorQuery): Promise<PrismCostEstimate>;
    issueProposalVersion(eventId: string, input: IssueProposalVersionInput, actor?: EventOpsActorQuery): Promise<PrismProposalVersion>;
    selectedQuoteLines(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEstimateLineSource[]>;
    previousCostEstimates(eventId: string, actor?: EventOpsActorQuery): Promise<PrismPreviousCostEstimate[]>;
    draftProposalWording(input: ProposalDraftRequest, actor?: EventOpsActorQuery): Promise<ProposalDraftResponse>;
    proposalComments(eventId: string, actor?: EventOpsActorQuery): Promise<PrismProposalComment[]>;
    addProposalComment(eventId: string, input: CreateProposalCommentInput, actor?: EventOpsActorQuery): Promise<PrismProposalComment>;
    clientReviewItems(eventId: string, actor?: EventOpsActorQuery): Promise<PrismClientReviewItem[]>;
    issueClientReviewItem(eventId: string, input: CreateClientReviewItemInput, actor?: EventOpsActorQuery): Promise<PrismClientReviewItem>;
    clientMessageTriggers(eventId: string, actor?: EventOpsActorQuery): Promise<PrismClientMessageTriggerState[]>;
    draftClientMessage(input: ClientMessageDraftRequest, actor?: EventOpsActorQuery): Promise<{ draft: CommsDraftResult; requestId: string; modelVersion: string }>;
    sendClientMessage(input: SendClientMessageInput, actor?: EventOpsActorQuery): Promise<{ sent: boolean }>;
    supplierGaps(eventId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierGap[]>;
    acknowledgeSupplierGap(eventId: string, categoryId: string, input: AcknowledgeSupplierGapInput, actor?: EventOpsActorQuery): Promise<PrismSupplierGap>;
    supplierSchedules(eventId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierSchedule[]>;
    supplierCategories(init?: EventOpsReadInit): Promise<PrismSupplierCategory[]>;
    supplierDirectory(query: PmcmSupplierDirectoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierDirectoryPage>;
    supplierProfile(supplierId: string, query: PmcmSupplierProfileQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierProfile>;
    supplierReviews(supplierId: string, query: PmcmSupplierHistoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierReviewsPage>;
    supplierCertifications(supplierId: string, query: PmcmSupplierHistoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierCertificationsPage>;
    supplierRecords(supplierId: string, query: PmcmSupplierRecordsQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierRecordsPage>;
    supplierEngagements(supplierId: string, query: PmcmSupplierHistoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>>;
  };
}
