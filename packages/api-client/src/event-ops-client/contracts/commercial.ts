import type {
  ChoosePresentationSlotInput,
  ChooseVenueScoutingPreferenceInput,
  CreateClientOwnedSupplierInput,
  DecideClientReviewItemInput,
  PrismClientBillingDispute,
  PrismPaymentSubmission,
  PrismFinanceDesk,
  PrismPaymentDetails,
  PrismPaymentHistory,
  PrismPaymentQrImage,
  PrismPaymentReminder,
  SubmitClientPaymentInput,
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
  PrismEventFinancialSummary,
  PrismPaymentAllocationTarget,
  PrismPaymentReceipt,
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierQuoteRoundComparison,
  AllocatePaymentReceiptInput,
  AttachPaymentReceiptEvidenceInput,
  EarmarkPaymentReceiptInput,
  ListPaymentAllocationTargetsQuery,
  ListPaymentReceiptsQuery,
  RecordPaymentInput,
  SavePaymentDetailsInput,
  RecordPaymentReceiptInput,
  RecordPaymentRefundInput,
  RejectPaymentReceiptInput,
  ReversePaymentAllocationInput,
  ReversePaymentReceiptInput,
  VerifyPaymentReceiptInput,
  RequestSupplierQuotesInput,
  AddSupplierQuoteInput,
  SupplierAvailabilityInput,
  UpdateSupplierInput,
  VerifySupplierStatusInput,
} from "@prism/types";
import type { PrismFile } from "../../http";
import type { EventOpsReadInit } from "./primitives";

/** Billing, payments, supplier records and quote requests: the PMCM commercial commands. */
export interface EventOpsCommercialContract {
  commercial: {
    createBillingSource(eventId: string, input: CreateBillingSourceInput): Promise<PrismBillingSource>;
    approveBillingSource(eventId: string, sourceId: string, approvalNotes?: string): Promise<PrismBillingSource>;
    generateBillingStatement(eventId: string, sourceId?: string): Promise<PrismBillingStatement>;
    sendBillingStatement(eventId: string, billingId: string): Promise<PrismBillingStatement>;
    createBillingDispute(eventId: string, input: CreateBillingDisputeInput): Promise<PrismBillingDispute>;
    resolveBillingDispute(eventId: string, disputeId: string, input: ResolveBillingDisputeInput): Promise<PrismBillingDispute>;
    requestBillingCorrection(eventId: string, input: RequestBillingCorrectionInput): Promise<PrismBillingCorrection>;
    resolveBillingCorrection(eventId: string, correctionId: string, input: ResolveBillingCorrectionInput): Promise<PrismBillingCorrection>;
    createAdditionalBilling(eventId: string, input: CreateAdditionalBillingInput): Promise<PrismAdditionalBilling>;
    waiveAdditionalBilling(eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput): Promise<PrismAdditionalBilling>;
    recordPayment(eventId: string, milestoneId: string, input: RecordPaymentInput): Promise<PrismPaymentMilestone>;
    /** PMCM reminds the client about one owed payment; at most once a day. */
    remindClientPayment(eventId: string, milestoneId: string): Promise<PrismPaymentReminder>;
    /** PMCM's one set of payment details. PMCM finance only. */
    paymentDetails(init?: EventOpsReadInit): Promise<PrismPaymentDetails>;
    savePaymentDetails(input: SavePaymentDetailsInput): Promise<PrismPaymentDetails>;
    /** Uploads a payment QR (PNG or JPEG, up to 1 MB); the same image always gives the same id. */
    uploadPaymentQr(file: File): Promise<PrismPaymentQrImage>;
    /** A payment QR image for PMCM's own screen. */
    paymentQrImage(imageId: string, init?: EventOpsReadInit): Promise<PrismFile>;
    /** Everything that happened to one payment, oldest first. PMCM finance only. */
    paymentHistory(eventId: string, milestoneId: string, init?: EventOpsReadInit): Promise<PrismPaymentHistory>;
    markPayment(eventId: string, milestoneId: string, input: MarkPaymentInput): Promise<PrismPaymentMilestone>;
    /** Money that arrived outside P.R.I.S.M: recorded first, applied to milestones afterwards. PMCM finance only. */
    /** PMCM finance across every active event: what needs PMCM, each event's money, and supplier payouts. */
    financeDesk(init?: EventOpsReadInit): Promise<PrismFinanceDesk>;
    listPaymentReceipts(query: ListPaymentReceiptsQuery, init?: EventOpsReadInit): Promise<PrismPaymentReceipt[]>;
    paymentReceipt(receiptId: string, init?: EventOpsReadInit): Promise<PrismPaymentReceipt>;
    /** Estimated and billed price, collections and how far to trust them, supplier cost and the margin. PMCM finance only. */
    eventFinancialSummary(eventId: string, init?: EventOpsReadInit): Promise<PrismEventFinancialSummary>;
    paymentAllocationTargets(query: ListPaymentAllocationTargetsQuery, init?: EventOpsReadInit): Promise<PrismPaymentAllocationTarget[]>;
    recordPaymentReceipt(input: RecordPaymentReceiptInput): Promise<PrismPaymentReceipt>;
    allocatePaymentReceipt(receiptId: string, input: AllocatePaymentReceiptInput): Promise<PrismPaymentReceipt>;
    attachPaymentReceiptEvidence(receiptId: string, input: AttachPaymentReceiptEvidenceInput): Promise<PrismPaymentReceipt>;
    earmarkPaymentReceipt(receiptId: string, input: EarmarkPaymentReceiptInput): Promise<PrismPaymentReceipt>;
    reversePaymentAllocation(receiptId: string, recordId: string, input: ReversePaymentAllocationInput): Promise<PrismPaymentReceipt>;
    verifyPaymentReceipt(receiptId: string, input: VerifyPaymentReceiptInput): Promise<PrismPaymentReceipt>;
    rejectPaymentReceipt(receiptId: string, input: RejectPaymentReceiptInput): Promise<PrismPaymentReceipt>;
    reversePaymentReceipt(receiptId: string, input: ReversePaymentReceiptInput): Promise<PrismPaymentReceipt>;
    recordPaymentRefund(receiptId: string, input: RecordPaymentRefundInput): Promise<PrismPaymentReceipt>;
    createSupplier(input: CreateSupplierInput): Promise<PrismSupplier>;
    updateSupplier(supplierId: string, input: UpdateSupplierInput): Promise<PrismSupplier>;
    changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput): Promise<PrismSupplier>;
    promoteSupplier(supplierId: string, input: PromoteSupplierInput): Promise<PrismSupplier>;
    addSupplierCertification(supplierId: string, input: CreateSupplierCertificationInput): Promise<PrismSupplier>;
    addSupplierReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput): Promise<PrismSupplier>;
    addSupplierReview(supplierId: string, input: CreateSupplierReviewInput): Promise<PrismSupplier>;
    setSupplierAvailability(supplierId: string, input: SupplierAvailabilityInput): Promise<{ id: string }>;
    /** A quote PMCM received outside the portal (phone, email), usually tied to the request it answers. */
    addSupplierQuote(eventId: string, input: AddSupplierQuoteInput): Promise<PrismSupplierQuote>;
    requestSupplierQuotes(eventId: string, input: RequestSupplierQuotesInput): Promise<PrismSupplierQuoteRequest[]>;
    withdrawQuoteRequest(eventId: string, requestId: string): Promise<{ ok: boolean }>;
    compareQuoteRound(eventId: string, roundId: string): Promise<PrismSupplierQuoteRoundComparison>;
    verifySupplierStatus(eventId: string, requestId: string, input: VerifySupplierStatusInput): Promise<PrismSupplierQuoteRequest>;
    selectSupplierQuote(eventId: string, quoteId: string): Promise<PrismSupplierQuote>;
    proposal(eventId: string): Promise<PrismEventProposalResponse>;
    createCostEstimate(eventId: string, input: CreateCostEstimateInput): Promise<PrismCostEstimate>;
    issueProposalVersion(eventId: string, input: IssueProposalVersionInput): Promise<PrismProposalVersion>;
    selectedQuoteLines(eventId: string): Promise<PrismEstimateLineSource[]>;
    previousCostEstimates(eventId: string): Promise<PrismPreviousCostEstimate[]>;
    draftProposalWording(input: ProposalDraftRequest): Promise<ProposalDraftResponse>;
    proposalComments(eventId: string): Promise<PrismProposalComment[]>;
    addProposalComment(eventId: string, input: CreateProposalCommentInput): Promise<PrismProposalComment>;
    clientReviewItems(eventId: string): Promise<PrismClientReviewItem[]>;
    issueClientReviewItem(eventId: string, input: CreateClientReviewItemInput): Promise<PrismClientReviewItem>;
    clientMessageTriggers(eventId: string): Promise<PrismClientMessageTriggerState[]>;
    draftClientMessage(input: ClientMessageDraftRequest): Promise<{ draft: CommsDraftResult; requestId: string; modelVersion: string }>;
    sendClientMessage(input: SendClientMessageInput): Promise<{ sent: boolean }>;
    externalCreativeTickets(eventId: string): Promise<PrismExternalCreativeTicket[]>;
    createExternalCreativeTicket(eventId: string, input: CreateExternalCreativeTicketInput): Promise<PrismExternalCreativeTicket>;
    updateExternalCreativeTicket(eventId: string, ticketId: string, input: UpdateExternalCreativeTicketInput): Promise<PrismExternalCreativeTicket>;
    completeExternalCreativeTicket(eventId: string, ticketId: string, input: CompleteExternalCreativeTicketInput): Promise<PrismExternalCreativeTicket>;
    venueScouting(eventId: string): Promise<PrismVenueScouting>;
    addVenueScoutingOption(eventId: string, input: CreateVenueScoutingOptionInput): Promise<PrismVenueScoutingOption>;
    withdrawVenueScoutingOption(eventId: string, optionId: string): Promise<PrismVenueScoutingOption>;
    publishVenueScouting(eventId: string): Promise<PrismVenueScouting>;
    presentationMeetings(eventId: string): Promise<PrismPresentationMeetings>;
    proposePresentationMeeting(eventId: string, input: ProposePresentationMeetingInput): Promise<PrismPresentationMeeting>;
    recordPresentationOutcome(eventId: string, meetingId: string, input: RecordPresentationOutcomeInput): Promise<PrismPresentationMeeting>;
    /** The client raises a dispute on their own statement; the API returns the client's view of it. */
    createClientBillingDispute(eventId: string, input: CreateBillingDisputeInput): Promise<PrismClientBillingDispute>;
    /** The client reports a payment they made; PMCM checks it before it counts. */
    submitClientPayment(eventId: string, input: SubmitClientPaymentInput): Promise<PrismPaymentSubmission>;
    attachClientPaymentProof(eventId: string, receiptId: string, input: AttachPaymentReceiptEvidenceInput): Promise<PrismPaymentSubmission>;
    decideClientReviewItem(eventId: string, itemId: string, input: DecideClientReviewItemInput): Promise<unknown>;
    chooseVenueScoutingPreference(eventId: string, input: ChooseVenueScoutingPreferenceInput): Promise<PrismVenueScouting>;
    choosePresentationSlot(eventId: string, meetingId: string, input: ChoosePresentationSlotInput): Promise<PrismPresentationMeeting>;
    createClientOwnedSupplier(eventId: string, input: CreateClientOwnedSupplierInput): Promise<PrismClientOwnedSupplier>;
    confirmClientOwnedSupplier(eventId: string, supplierId: string): Promise<PrismClientOwnedSupplier>;
    unresponsiveSuppliers(eventId: string): Promise<PrismUnresponsiveSupplier[]>;
    clientOwnedSuppliers(eventId: string): Promise<PrismClientOwnedSupplier[]>;
    raiseClientSupplierRisk(eventId: string, supplierId: string, input: RaiseClientSupplierRiskInput): Promise<PrismClientOwnedSupplier>;
    supplierGaps(eventId: string): Promise<PrismSupplierGap[]>;
    acknowledgeSupplierGap(eventId: string, categoryId: string, input: AcknowledgeSupplierGapInput): Promise<PrismSupplierGap>;
    supplierSchedules(eventId: string): Promise<PrismSupplierSchedule[]>;
    supplierCategories(init?: EventOpsReadInit): Promise<PrismSupplierCategory[]>;
    supplierDirectory(query: PmcmSupplierDirectoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierDirectoryPage>;
    supplierProfile(supplierId: string, query: PmcmSupplierProfileQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierProfile>;
    supplierReviews(supplierId: string, query: PmcmSupplierHistoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierReviewsPage>;
    supplierCertifications(supplierId: string, query: PmcmSupplierHistoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierCertificationsPage>;
    supplierRecords(supplierId: string, query: PmcmSupplierRecordsQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierRecordsPage>;
    supplierEngagements(supplierId: string, query: PmcmSupplierHistoryQuery, init?: EventOpsReadInit): Promise<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>>;
  };
}
