import type {
  PrismClientBillingDispute,
  PrismClientOwnedSupplier,
  PrismExternalCreativeTicket,
  PrismPresentationMeeting,
  PrismPresentationMeetings,
  PrismUnresponsiveSupplier,
  PrismVenueScouting,
  PrismVenueScoutingOption,
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
  CommsDraftResult,
  PrismClientMessageTriggerState,
  PrismClientReviewItem,
  PrismCostEstimate,
  PrismEstimateLineSource,
  PrismEventProposalResponse,
  PrismPreviousCostEstimate,
  PrismProposalComment,
  PrismProposalVersion,
  ProposalDraftResponse,
  PrismAdditionalBilling,
  PrismBillingCorrection,
  PrismBillingDispute,
  PrismBillingSource,
  PrismBillingStatement,
  PrismEventFinancialSummary,
  PrismPaymentAllocationTarget,
  PrismPaymentMilestone,
  PrismPaymentReceipt,
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierQuoteRoundComparison,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createCommercialClient(options: EventOpsClientOptions): Pick<EventOpsClient, "commercial"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  const supplier = (supplierId: string, rest = "") => `/suppliers/${encodeURIComponent(supplierId)}${rest}`;
  const receipt = (receiptId: string, rest = "") => `/payment-receipts/${encodeURIComponent(receiptId)}${rest}`;
  /** `?a=b` for a non-empty query, nothing otherwise. */
  const search = (values: object) => {
    const text = toQueryString(values as Record<string, string | number | boolean | null | undefined>);
    return text ? `?${text}` : "";
  };
  return {
    commercial: {
      createBillingSource: (eventId, input, actor = {}) =>
        prismRequest<PrismBillingSource>(actorPath(event(eventId, "/billing-source"), actor), withBase(options, { method: "POST", body: input })),
      approveBillingSource: (eventId, sourceId, approvalNotes, actor = {}) =>
        prismRequest<PrismBillingSource>(actorPath(event(eventId, `/billing-source/${sourceId}/approve`), actor), withBase(options, { method: "PATCH", body: { approvalNotes } })),
      generateBillingStatement: (eventId, sourceId, actor = {}) =>
        prismRequest<PrismBillingStatement>(actorPath(event(eventId, "/billing-statements/generate"), actor), withBase(options, { method: "POST", body: { sourceId } })),
      sendBillingStatement: (eventId, billingId, actor = {}) =>
        prismRequest<PrismBillingStatement>(actorPath(event(eventId, `/billing-statements/${billingId}/send`), actor), withBase(options, { method: "POST" })),
      createBillingDispute: (eventId, input, actor = {}) =>
        prismRequest<PrismBillingDispute>(actorPath(event(eventId, "/billing-disputes"), actor), withBase(options, { method: "POST", body: input })),
      resolveBillingDispute: (eventId, disputeId, input, actor = {}) =>
        prismRequest<PrismBillingDispute>(actorPath(event(eventId, `/billing-disputes/${disputeId}`), actor), withBase(options, { method: "PATCH", body: input })),
      requestBillingCorrection: (eventId, input, actor = {}) =>
        prismRequest<PrismBillingCorrection>(actorPath(event(eventId, "/billing-corrections"), actor), withBase(options, { method: "POST", body: input })),
      resolveBillingCorrection: (eventId, correctionId, input, actor = {}) =>
        prismRequest<PrismBillingCorrection>(actorPath(event(eventId, `/billing-corrections/${correctionId}`), actor), withBase(options, { method: "PATCH", body: input })),
      createAdditionalBilling: (eventId, input, actor = {}) =>
        prismRequest<PrismAdditionalBilling>(actorPath(event(eventId, "/additional-billing"), actor), withBase(options, { method: "POST", body: input })),
      waiveAdditionalBilling: (eventId, additionalBillingId, input, actor = {}) =>
        prismRequest<PrismAdditionalBilling>(actorPath(event(eventId, `/additional-billing/${additionalBillingId}/waive`), actor), withBase(options, { method: "PATCH", body: input })),
      recordPayment: (eventId, milestoneId, input, actor = {}) =>
        prismRequest<PrismPaymentMilestone>(actorPath(event(eventId, `/payments/${milestoneId}/records`), actor), withBase(options, { method: "POST", body: input })),
      markPayment: (eventId, milestoneId, input, actor = {}) =>
        prismRequest<PrismPaymentMilestone>(actorPath(event(eventId, `/payments/${milestoneId}`), actor), withBase(options, { method: "PATCH", body: input })),
      listPaymentReceipts: (query, init = {}) =>
        prismRequest<PrismPaymentReceipt[]>(`/payment-receipts${search(query)}`, withBase(options, { signal: init.signal })),
      eventFinancialSummary: (eventId, init = {}) =>
        prismRequest<PrismEventFinancialSummary>(event(eventId, "/financial-summary"), withBase(options, { signal: init.signal })),
      paymentReceipt: (receiptId, init = {}) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId), withBase(options, { signal: init.signal })),
      paymentAllocationTargets: (query, init = {}) =>
        prismRequest<PrismPaymentAllocationTarget[]>(`/payment-receipts/allocation-targets${search(query)}`, withBase(options, { signal: init.signal })),
      recordPaymentReceipt: (input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath("/payment-receipts", actor), withBase(options, { method: "POST", body: input })),
      allocatePaymentReceipt: (receiptId, input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath(receipt(receiptId, "/allocations"), actor), withBase(options, { method: "POST", body: input })),
      reversePaymentAllocation: (receiptId, recordId, input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath(receipt(receiptId, `/allocations/${encodeURIComponent(recordId)}/reverse`), actor), withBase(options, { method: "POST", body: input })),
      verifyPaymentReceipt: (receiptId, input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath(receipt(receiptId, "/verify"), actor), withBase(options, { method: "POST", body: input })),
      rejectPaymentReceipt: (receiptId, input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath(receipt(receiptId, "/reject"), actor), withBase(options, { method: "POST", body: input })),
      reversePaymentReceipt: (receiptId, input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath(receipt(receiptId, "/reverse"), actor), withBase(options, { method: "POST", body: input })),
      recordPaymentRefund: (receiptId, input, actor = {}) =>
        prismRequest<PrismPaymentReceipt>(actorPath(receipt(receiptId, "/refunds"), actor), withBase(options, { method: "POST", body: input })),
      createSupplier: (input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath("/suppliers", actor), withBase(options, { method: "POST", body: input })),
      updateSupplier: (supplierId, input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath(supplier(supplierId), actor), withBase(options, { method: "PATCH", body: input })),
      changeSupplierTier: (supplierId, input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath(supplier(supplierId, "/tier"), actor), withBase(options, { method: "PATCH", body: input })),
      promoteSupplier: (supplierId, input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath(supplier(supplierId, "/promote"), actor), withBase(options, { method: "POST", body: input })),
      addSupplierCertification: (supplierId, input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath(supplier(supplierId, "/certifications"), actor), withBase(options, { method: "POST", body: input })),
      addSupplierReliabilityNote: (supplierId, input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath(supplier(supplierId, "/reliability-notes"), actor), withBase(options, { method: "POST", body: input })),
      addSupplierReview: (supplierId, input, actor = {}) =>
        prismRequest<PrismSupplier>(actorPath(supplier(supplierId, "/reviews"), actor), withBase(options, { method: "POST", body: input })),
      setSupplierAvailability: (supplierId, input, actor = {}) =>
        prismRequest<{ id: string }>(actorPath(supplier(supplierId, "/availability"), actor), withBase(options, { method: "POST", body: input })),
      requestSupplierQuotes: (eventId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest[]>(actorPath(event(eventId, "/quote-requests"), actor), withBase(options, { method: "POST", body: input })),
      withdrawQuoteRequest: (eventId, requestId, actor = {}) =>
        prismRequest<{ ok: boolean }>(actorPath(event(eventId, `/quote-requests/${requestId}/withdraw`), actor), withBase(options, { method: "PATCH" })),
      compareQuoteRound: (eventId, roundId, actor = {}) =>
        prismRequest<PrismSupplierQuoteRoundComparison>(actorPath(event(eventId, `/quote-rounds/${encodeURIComponent(roundId)}/comparison`), actor), withBase(options)),
      verifySupplierStatus: (eventId, requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(actorPath(event(eventId, `/supplier-status/${requestId}/verify`), actor), withBase(options, { method: "PATCH", body: input })),
      proposal: (eventId, actor = {}) =>
        prismRequest<PrismEventProposalResponse>(actorPath(event(eventId, "/proposal"), actor), withBase(options)),
      createCostEstimate: (eventId, input, actor = {}) =>
        prismRequest<PrismCostEstimate>(actorPath(event(eventId, "/cost-estimates"), actor), withBase(options, { method: "POST", body: input })),
      issueProposalVersion: (eventId, input, actor = {}) =>
        prismRequest<PrismProposalVersion>(actorPath(event(eventId, "/proposal/versions"), actor), withBase(options, { method: "POST", body: input })),
      selectedQuoteLines: (eventId, actor = {}) =>
        prismRequest<PrismEstimateLineSource[]>(actorPath(event(eventId, "/cost-estimates/supplier-quote-lines"), actor), withBase(options)),
      previousCostEstimates: (eventId, actor = {}) =>
        prismRequest<PrismPreviousCostEstimate[]>(actorPath(event(eventId, "/cost-estimates/previous"), actor), withBase(options)),
      draftProposalWording: (input, actor = {}) =>
        prismRequest<ProposalDraftResponse>(actorPath("/proposal-drafts", actor), withBase(options, { method: "POST", body: input })),
      proposalComments: (eventId, actor = {}) =>
        prismRequest<PrismProposalComment[]>(actorPath(event(eventId, "/proposal/comments"), actor), withBase(options)),
      addProposalComment: (eventId, input, actor = {}) =>
        prismRequest<PrismProposalComment>(actorPath(event(eventId, "/proposal/comments"), actor), withBase(options, { method: "POST", body: input })),
      clientReviewItems: (eventId, actor = {}) =>
        prismRequest<PrismClientReviewItem[]>(actorPath(event(eventId, "/client-review-items"), actor), withBase(options)),
      issueClientReviewItem: (eventId, input, actor = {}) =>
        prismRequest<PrismClientReviewItem>(actorPath(event(eventId, "/client-review-items"), actor), withBase(options, { method: "POST", body: input })),
      clientMessageTriggers: (eventId, actor = {}) =>
        prismRequest<PrismClientMessageTriggerState[]>(actorPath(event(eventId, "/client-message-triggers"), actor), withBase(options)),
      draftClientMessage: (input, actor = {}) =>
        prismRequest<{ draft: CommsDraftResult; requestId: string; modelVersion: string }>(actorPath("/client-message-drafts", actor), withBase(options, { method: "POST", body: input })),
      sendClientMessage: (input, actor = {}) =>
        prismRequest<{ sent: boolean }>(actorPath("/client-message-drafts/send", actor), withBase(options, { method: "POST", body: input })),
      externalCreativeTickets: (eventId, actor = {}) =>
        prismRequest<PrismExternalCreativeTicket[]>(actorPath(event(eventId, "/external-creative-tickets"), actor), withBase(options)),
      createExternalCreativeTicket: (eventId, input, actor = {}) =>
        prismRequest<PrismExternalCreativeTicket>(actorPath(event(eventId, "/external-creative-tickets"), actor), withBase(options, { method: "POST", body: input })),
      updateExternalCreativeTicket: (eventId, ticketId, input, actor = {}) =>
        prismRequest<PrismExternalCreativeTicket>(actorPath(event(eventId, `/external-creative-tickets/${ticketId}`), actor), withBase(options, { method: "PATCH", body: input })),
      completeExternalCreativeTicket: (eventId, ticketId, input, actor = {}) =>
        prismRequest<PrismExternalCreativeTicket>(actorPath(event(eventId, `/external-creative-tickets/${ticketId}/complete`), actor), withBase(options, { method: "POST", body: input })),
      venueScouting: (eventId, actor = {}) =>
        prismRequest<PrismVenueScouting>(actorPath(event(eventId, "/venue-scouting"), actor), withBase(options)),
      addVenueScoutingOption: (eventId, input, actor = {}) =>
        prismRequest<PrismVenueScoutingOption>(actorPath(event(eventId, "/venue-scouting/options"), actor), withBase(options, { method: "POST", body: input })),
      withdrawVenueScoutingOption: (eventId, optionId, actor = {}) =>
        prismRequest<PrismVenueScoutingOption>(actorPath(event(eventId, `/venue-scouting/options/${optionId}/withdraw`), actor), withBase(options, { method: "POST" })),
      publishVenueScouting: (eventId, actor = {}) =>
        prismRequest<PrismVenueScouting>(actorPath(event(eventId, "/venue-scouting/publish"), actor), withBase(options, { method: "POST" })),
      presentationMeetings: (eventId, actor = {}) =>
        prismRequest<PrismPresentationMeetings>(actorPath(`/events/${encodeURIComponent(eventId)}/presentation-meetings`, actor), withBase(options)),
      proposePresentationMeeting: (eventId, input, actor = {}) =>
        prismRequest<PrismPresentationMeeting>(actorPath(`/events/${encodeURIComponent(eventId)}/presentation-meetings`, actor), withBase(options, { method: "POST", body: input })),
      recordPresentationOutcome: (eventId, meetingId, input, actor = {}) =>
        prismRequest<PrismPresentationMeeting>(actorPath(`/events/${encodeURIComponent(eventId)}/presentation-meetings/${encodeURIComponent(meetingId)}/outcome`, actor), withBase(options, { method: "POST", body: input })),
      createClientBillingDispute: (eventId, input, actor = {}) =>
        prismRequest<PrismClientBillingDispute>(actorPath(event(eventId, "/billing-disputes"), actor), withBase(options, { method: "POST", body: input })),
      decideClientReviewItem: (eventId, itemId, input, actor = {}) =>
        prismRequest<unknown>(actorPath(event(eventId, `/client-review-items/${itemId}/decisions`), actor), withBase(options, { method: "POST", body: input })),
      chooseVenueScoutingPreference: (eventId, input, actor = {}) =>
        prismRequest<PrismVenueScouting>(actorPath(event(eventId, "/venue-scouting/preference"), actor), withBase(options, { method: "POST", body: input })),
      choosePresentationSlot: (eventId, meetingId, input, actor = {}) =>
        prismRequest<PrismPresentationMeeting>(actorPath(`/events/${encodeURIComponent(eventId)}/presentation-meetings/${encodeURIComponent(meetingId)}/choice`, actor), withBase(options, { method: "POST", body: input })),
      createClientOwnedSupplier: (eventId, input, actor = {}) =>
        prismRequest<PrismClientOwnedSupplier>(actorPath(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers`, actor), withBase(options, { method: "POST", body: input })),
      confirmClientOwnedSupplier: (eventId, supplierId, actor = {}) =>
        prismRequest<PrismClientOwnedSupplier>(actorPath(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers/${encodeURIComponent(supplierId)}/confirm`, actor), withBase(options, { method: "POST" })),
      unresponsiveSuppliers: (eventId, actor = {}) =>
        prismRequest<PrismUnresponsiveSupplier[]>(actorPath(`/events/${encodeURIComponent(eventId)}/unresponsive-suppliers`, actor), withBase(options)),
      clientOwnedSuppliers: (eventId, actor = {}) =>
        prismRequest<PrismClientOwnedSupplier[]>(actorPath(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers`, actor), withBase(options)),
      raiseClientSupplierRisk: (eventId, supplierId, input, actor = {}) =>
        prismRequest<PrismClientOwnedSupplier>(actorPath(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers/${encodeURIComponent(supplierId)}/risk-warning`, actor), withBase(options, { method: "POST", body: input })),
      supplierGaps: (eventId, actor = {}) =>
        prismRequest<PrismSupplierGap[]>(actorPath(event(eventId, "/supplier-gaps"), actor), withBase(options)),
      acknowledgeSupplierGap: (eventId, categoryId, input, actor = {}) =>
        prismRequest<PrismSupplierGap>(actorPath(event(eventId, `/supplier-gaps/${categoryId}/acknowledge`), actor), withBase(options, { method: "POST", body: input })),
      supplierSchedules: (eventId, actor = {}) =>
        prismRequest<PrismSupplierSchedule[]>(actorPath(`/events/${encodeURIComponent(eventId)}/supplier-schedules`, actor), withBase(options)),
      supplierCategories: (init = {}) =>
        prismRequest<PrismSupplierCategory[]>("/suppliers/categories", withBase(options, { signal: init.signal })),
      supplierDirectory: (query, init = {}) =>
        prismRequest<PrismPmcmSupplierDirectoryPage>(`/suppliers/directory${search(query)}`, withBase(options, { signal: init.signal })),
      supplierProfile: (supplierId, query, init = {}) =>
        prismRequest<PrismPmcmSupplierProfile>(`${supplier(supplierId, "/profile")}${search(query)}`, withBase(options, { signal: init.signal })),
      supplierReviews: (supplierId, query, init = {}) =>
        prismRequest<PrismPmcmSupplierReviewsPage>(`${supplier(supplierId, "/reviews")}${search(query)}`, withBase(options, { signal: init.signal })),
      supplierCertifications: (supplierId, query, init = {}) =>
        prismRequest<PrismPmcmSupplierCertificationsPage>(`${supplier(supplierId, "/certifications")}${search(query)}`, withBase(options, { signal: init.signal })),
      supplierRecords: (supplierId, query, init = {}) =>
        prismRequest<PrismPmcmSupplierRecordsPage>(`${supplier(supplierId, "/records")}${search(query)}`, withBase(options, { signal: init.signal })),
      supplierEngagements: (supplierId, query, init = {}) =>
        prismRequest<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>>(`/pmcm/suppliers/${encodeURIComponent(supplierId)}/engagements${search(query)}`, withBase(options, { signal: init.signal })),
      selectSupplierQuote: (eventId, quoteId, actor = {}) =>
        prismRequest<PrismSupplierQuote>(actorPath(event(eventId, `/supplier-quotes/${quoteId}/select`), actor), withBase(options, { method: "PATCH" })),
    },
  };
}
