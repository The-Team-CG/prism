import type {
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
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

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
    selectSupplierQuote(eventId: string, quoteId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierQuote>;
  };
}
