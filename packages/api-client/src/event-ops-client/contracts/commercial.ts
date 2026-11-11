import type {
  ChoosePresentationSlotInput,
  ChooseVenueScoutingPreferenceInput,
  CreateClientOwnedSupplierInput,
  DecideClientReviewItemInput,
  PrismClientBillingDispute,
  CompleteExternalCreativeTicketInput,
  CreateExternalCreativeTicketInput,
  CreateVenueScoutingOptionInput,
  PrismClientOwnedSupplier,
  PrismExternalCreativeTicket,
  PrismPresentationMeeting,
  PrismPresentationMeetings,
  PrismUnresponsiveSupplier,
  PrismVenueScouting,
  PrismVenueScoutingOption,
  ProposePresentationMeetingInput,
  RaiseClientSupplierRiskInput,
  RecordPresentationOutcomeInput,
  UpdateExternalCreativeTicketInput,
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
  PrismPaymentAllocationTarget,
  PrismPaymentReceipt,
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierQuoteRoundComparison,
  AllocatePaymentReceiptInput,
  ListPaymentAllocationTargetsQuery,
  ListPaymentReceiptsQuery,
  RecordPaymentInput,
  RecordPaymentReceiptInput,
  RecordPaymentRefundInput,
  RejectPaymentReceiptInput,
  ReversePaymentAllocationInput,
  ReversePaymentReceiptInput,
  VerifyPaymentReceiptInput,
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
    /** Money that arrived outside P.R.I.S.M: recorded first, applied to milestones afterwards. PMCM finance only. */
    listPaymentReceipts(query: ListPaymentReceiptsQuery, init?: EventOpsReadInit): Promise<PrismPaymentReceipt[]>;
    paymentReceipt(receiptId: string, init?: EventOpsReadInit): Promise<PrismPaymentReceipt>;
    paymentAllocationTargets(query: ListPaymentAllocationTargetsQuery, init?: EventOpsReadInit): Promise<PrismPaymentAllocationTarget[]>;
    recordPaymentReceipt(input: RecordPaymentReceiptInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
    allocatePaymentReceipt(receiptId: string, input: AllocatePaymentReceiptInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
    reversePaymentAllocation(receiptId: string, recordId: string, input: ReversePaymentAllocationInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
    verifyPaymentReceipt(receiptId: string, input: VerifyPaymentReceiptInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
    rejectPaymentReceipt(receiptId: string, input: RejectPaymentReceiptInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
    reversePaymentReceipt(receiptId: string, input: ReversePaymentReceiptInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
    recordPaymentRefund(receiptId: string, input: RecordPaymentRefundInput, actor?: EventOpsActorQuery): Promise<PrismPaymentReceipt>;
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
    externalCreativeTickets(eventId: string, actor?: EventOpsActorQuery): Promise<PrismExternalCreativeTicket[]>;
    createExternalCreativeTicket(eventId: string, input: CreateExternalCreativeTicketInput, actor?: EventOpsActorQuery): Promise<PrismExternalCreativeTicket>;
    updateExternalCreativeTicket(eventId: string, ticketId: string, input: UpdateExternalCreativeTicketInput, actor?: EventOpsActorQuery): Promise<PrismExternalCreativeTicket>;
    completeExternalCreativeTicket(eventId: string, ticketId: string, input: CompleteExternalCreativeTicketInput, actor?: EventOpsActorQuery): Promise<PrismExternalCreativeTicket>;
    venueScouting(eventId: string, actor?: EventOpsActorQuery): Promise<PrismVenueScouting>;
    addVenueScoutingOption(eventId: string, input: CreateVenueScoutingOptionInput, actor?: EventOpsActorQuery): Promise<PrismVenueScoutingOption>;
    withdrawVenueScoutingOption(eventId: string, optionId: string, actor?: EventOpsActorQuery): Promise<PrismVenueScoutingOption>;
    publishVenueScouting(eventId: string, actor?: EventOpsActorQuery): Promise<PrismVenueScouting>;
    presentationMeetings(eventId: string, actor?: EventOpsActorQuery): Promise<PrismPresentationMeetings>;
    proposePresentationMeeting(eventId: string, input: ProposePresentationMeetingInput, actor?: EventOpsActorQuery): Promise<PrismPresentationMeeting>;
    recordPresentationOutcome(eventId: string, meetingId: string, input: RecordPresentationOutcomeInput, actor?: EventOpsActorQuery): Promise<PrismPresentationMeeting>;
    /** The client raises a dispute on their own statement; the API returns the client's view of it. */
    createClientBillingDispute(eventId: string, input: CreateBillingDisputeInput, actor?: EventOpsActorQuery): Promise<PrismClientBillingDispute>;
    decideClientReviewItem(eventId: string, itemId: string, input: DecideClientReviewItemInput, actor?: EventOpsActorQuery): Promise<unknown>;
    chooseVenueScoutingPreference(eventId: string, input: ChooseVenueScoutingPreferenceInput, actor?: EventOpsActorQuery): Promise<PrismVenueScouting>;
    choosePresentationSlot(eventId: string, meetingId: string, input: ChoosePresentationSlotInput, actor?: EventOpsActorQuery): Promise<PrismPresentationMeeting>;
    createClientOwnedSupplier(eventId: string, input: CreateClientOwnedSupplierInput, actor?: EventOpsActorQuery): Promise<PrismClientOwnedSupplier>;
    confirmClientOwnedSupplier(eventId: string, supplierId: string, actor?: EventOpsActorQuery): Promise<PrismClientOwnedSupplier>;
    unresponsiveSuppliers(eventId: string, actor?: EventOpsActorQuery): Promise<PrismUnresponsiveSupplier[]>;
    clientOwnedSuppliers(eventId: string, actor?: EventOpsActorQuery): Promise<PrismClientOwnedSupplier[]>;
    raiseClientSupplierRisk(eventId: string, supplierId: string, input: RaiseClientSupplierRiskInput, actor?: EventOpsActorQuery): Promise<PrismClientOwnedSupplier>;
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
