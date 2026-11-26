import type {
  PrismClientBillingDispute,
  PrismPaymentSubmission,
  PrismFinanceDesk,
  PrismPaymentDetails,
  PrismPaymentHistory,
  PrismPaymentQrImage,
  PrismPaymentReminder,
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
import { prismFile, prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

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
      createBillingSource: (eventId, input) =>
        prismRequest<PrismBillingSource>(event(eventId, "/billing-source"), withBase(options, { method: "POST", body: input })),
      approveBillingSource: (eventId, sourceId, approvalNotes) =>
        prismRequest<PrismBillingSource>(event(eventId, `/billing-source/${sourceId}/approve`), withBase(options, { method: "PATCH", body: { approvalNotes } })),
      generateBillingStatement: (eventId, sourceId) =>
        prismRequest<PrismBillingStatement>(event(eventId, "/billing-statements/generate"), withBase(options, { method: "POST", body: { sourceId } })),
      sendBillingStatement: (eventId, billingId) =>
        prismRequest<PrismBillingStatement>(event(eventId, `/billing-statements/${billingId}/send`), withBase(options, { method: "POST" })),
      createBillingDispute: (eventId, input) =>
        prismRequest<PrismBillingDispute>(event(eventId, "/billing-disputes"), withBase(options, { method: "POST", body: input })),
      resolveBillingDispute: (eventId, disputeId, input) =>
        prismRequest<PrismBillingDispute>(event(eventId, `/billing-disputes/${disputeId}`), withBase(options, { method: "PATCH", body: input })),
      requestBillingCorrection: (eventId, input) =>
        prismRequest<PrismBillingCorrection>(event(eventId, "/billing-corrections"), withBase(options, { method: "POST", body: input })),
      resolveBillingCorrection: (eventId, correctionId, input) =>
        prismRequest<PrismBillingCorrection>(event(eventId, `/billing-corrections/${correctionId}`), withBase(options, { method: "PATCH", body: input })),
      createAdditionalBilling: (eventId, input) =>
        prismRequest<PrismAdditionalBilling>(event(eventId, "/additional-billing"), withBase(options, { method: "POST", body: input })),
      waiveAdditionalBilling: (eventId, additionalBillingId, input) =>
        prismRequest<PrismAdditionalBilling>(event(eventId, `/additional-billing/${additionalBillingId}/waive`), withBase(options, { method: "PATCH", body: input })),
      recordPayment: (eventId, milestoneId, input) =>
        prismRequest<PrismPaymentMilestone>(event(eventId, `/payments/${milestoneId}/records`), withBase(options, { method: "POST", body: input })),
      remindClientPayment: (eventId, milestoneId) =>
        prismRequest<PrismPaymentReminder>(event(eventId, `/payments/${encodeURIComponent(milestoneId)}/reminders`), withBase(options, { method: "POST" })),
      paymentDetails: (init = {}) =>
        prismRequest<PrismPaymentDetails>("/payment-details", withBase(options, { signal: init.signal })),
      savePaymentDetails: (input) =>
        prismRequest<PrismPaymentDetails>("/payment-details", withBase(options, { method: "PUT", body: input })),
      uploadPaymentQr: (file) =>
        prismRequest<PrismPaymentQrImage>("/payment-details/qr-images", withBase(options, { method: "POST", body: file, headers: { "Content-Type": file.type } })),
      paymentQrImage: (imageId, init = {}) =>
        prismFile(`/payment-details/qr-images/${encodeURIComponent(imageId)}`, withBase(options, { signal: init.signal }), "payment-qr"),
      paymentHistory: (eventId, milestoneId, init = {}) =>
        prismRequest<PrismPaymentHistory>(event(eventId, `/payments/${encodeURIComponent(milestoneId)}/history`), withBase(options, { signal: init.signal })),
      markPayment: (eventId, milestoneId, input) =>
        prismRequest<PrismPaymentMilestone>(event(eventId, `/payments/${milestoneId}`), withBase(options, { method: "PATCH", body: input })),
      financeDesk: (init = {}) =>
        prismRequest<PrismFinanceDesk>("/finance/desk", withBase(options, { signal: init.signal })),
      listPaymentReceipts: (query, init = {}) =>
        prismRequest<PrismPaymentReceipt[]>(`/payment-receipts${search(query)}`, withBase(options, { signal: init.signal })),
      eventFinancialSummary: (eventId, init = {}) =>
        prismRequest<PrismEventFinancialSummary>(event(eventId, "/financial-summary"), withBase(options, { signal: init.signal })),
      paymentReceipt: (receiptId, init = {}) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId), withBase(options, { signal: init.signal })),
      paymentAllocationTargets: (query, init = {}) =>
        prismRequest<PrismPaymentAllocationTarget[]>(`/payment-receipts/allocation-targets${search(query)}`, withBase(options, { signal: init.signal })),
      recordPaymentReceipt: (input) =>
        prismRequest<PrismPaymentReceipt>("/payment-receipts", withBase(options, { method: "POST", body: input })),
      allocatePaymentReceipt: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/allocations"), withBase(options, { method: "POST", body: input })),
      attachPaymentReceiptEvidence: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/evidence"), withBase(options, { method: "POST", body: input })),
      earmarkPaymentReceipt: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/event"), withBase(options, { method: "POST", body: input })),
      reversePaymentAllocation: (receiptId, recordId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, `/allocations/${encodeURIComponent(recordId)}/reverse`), withBase(options, { method: "POST", body: input })),
      verifyPaymentReceipt: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/verify"), withBase(options, { method: "POST", body: input })),
      rejectPaymentReceipt: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/reject"), withBase(options, { method: "POST", body: input })),
      reversePaymentReceipt: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/reverse"), withBase(options, { method: "POST", body: input })),
      recordPaymentRefund: (receiptId, input) =>
        prismRequest<PrismPaymentReceipt>(receipt(receiptId, "/refunds"), withBase(options, { method: "POST", body: input })),
      createSupplier: (input) =>
        prismRequest<PrismSupplier>("/suppliers", withBase(options, { method: "POST", body: input })),
      updateSupplier: (supplierId, input) =>
        prismRequest<PrismSupplier>(supplier(supplierId), withBase(options, { method: "PATCH", body: input })),
      changeSupplierTier: (supplierId, input) =>
        prismRequest<PrismSupplier>(supplier(supplierId, "/tier"), withBase(options, { method: "PATCH", body: input })),
      promoteSupplier: (supplierId, input) =>
        prismRequest<PrismSupplier>(supplier(supplierId, "/promote"), withBase(options, { method: "POST", body: input })),
      addSupplierCertification: (supplierId, input) =>
        prismRequest<PrismSupplier>(supplier(supplierId, "/certifications"), withBase(options, { method: "POST", body: input })),
      addSupplierReliabilityNote: (supplierId, input) =>
        prismRequest<PrismSupplier>(supplier(supplierId, "/reliability-notes"), withBase(options, { method: "POST", body: input })),
      addSupplierReview: (supplierId, input) =>
        prismRequest<PrismSupplier>(supplier(supplierId, "/reviews"), withBase(options, { method: "POST", body: input })),
      setSupplierAvailability: (supplierId, input) =>
        prismRequest<{ id: string }>(supplier(supplierId, "/availability"), withBase(options, { method: "POST", body: input })),
      addSupplierQuote: (eventId, input) =>
        prismRequest<PrismSupplierQuote>(event(eventId, "/supplier-quotes"), withBase(options, { method: "POST", body: input })),
      requestSupplierQuotes: (eventId, input) =>
        prismRequest<PrismSupplierQuoteRequest[]>(event(eventId, "/quote-requests"), withBase(options, { method: "POST", body: input })),
      withdrawQuoteRequest: (eventId, requestId) =>
        prismRequest<{ ok: boolean }>(event(eventId, `/quote-requests/${requestId}/withdraw`), withBase(options, { method: "PATCH" })),
      compareQuoteRound: (eventId, roundId) =>
        prismRequest<PrismSupplierQuoteRoundComparison>(event(eventId, `/quote-rounds/${encodeURIComponent(roundId)}/comparison`), withBase(options)),
      verifySupplierStatus: (eventId, requestId, input) =>
        prismRequest<PrismSupplierQuoteRequest>(event(eventId, `/supplier-status/${requestId}/verify`), withBase(options, { method: "PATCH", body: input })),
      proposal: (eventId) =>
        prismRequest<PrismEventProposalResponse>(event(eventId, "/proposal"), withBase(options)),
      createCostEstimate: (eventId, input) =>
        prismRequest<PrismCostEstimate>(event(eventId, "/cost-estimates"), withBase(options, { method: "POST", body: input })),
      issueProposalVersion: (eventId, input) =>
        prismRequest<PrismProposalVersion>(event(eventId, "/proposal/versions"), withBase(options, { method: "POST", body: input })),
      selectedQuoteLines: (eventId) =>
        prismRequest<PrismEstimateLineSource[]>(event(eventId, "/cost-estimates/supplier-quote-lines"), withBase(options)),
      previousCostEstimates: (eventId) =>
        prismRequest<PrismPreviousCostEstimate[]>(event(eventId, "/cost-estimates/previous"), withBase(options)),
      draftProposalWording: (input) =>
        prismRequest<ProposalDraftResponse>("/proposal-drafts", withBase(options, { method: "POST", body: input })),
      proposalComments: (eventId) =>
        prismRequest<PrismProposalComment[]>(event(eventId, "/proposal/comments"), withBase(options)),
      addProposalComment: (eventId, input) =>
        prismRequest<PrismProposalComment>(event(eventId, "/proposal/comments"), withBase(options, { method: "POST", body: input })),
      clientReviewItems: (eventId) =>
        prismRequest<PrismClientReviewItem[]>(event(eventId, "/client-review-items"), withBase(options)),
      issueClientReviewItem: (eventId, input) =>
        prismRequest<PrismClientReviewItem>(event(eventId, "/client-review-items"), withBase(options, { method: "POST", body: input })),
      clientMessageTriggers: (eventId) =>
        prismRequest<PrismClientMessageTriggerState[]>(event(eventId, "/client-message-triggers"), withBase(options)),
      draftClientMessage: (input) =>
        prismRequest<{ draft: CommsDraftResult; requestId: string; modelVersion: string }>("/client-message-drafts", withBase(options, { method: "POST", body: input })),
      sendClientMessage: (input) =>
        prismRequest<{ sent: boolean }>("/client-message-drafts/send", withBase(options, { method: "POST", body: input })),
      externalCreativeTickets: (eventId) =>
        prismRequest<PrismExternalCreativeTicket[]>(event(eventId, "/external-creative-tickets"), withBase(options)),
      createExternalCreativeTicket: (eventId, input) =>
        prismRequest<PrismExternalCreativeTicket>(event(eventId, "/external-creative-tickets"), withBase(options, { method: "POST", body: input })),
      updateExternalCreativeTicket: (eventId, ticketId, input) =>
        prismRequest<PrismExternalCreativeTicket>(event(eventId, `/external-creative-tickets/${ticketId}`), withBase(options, { method: "PATCH", body: input })),
      completeExternalCreativeTicket: (eventId, ticketId, input) =>
        prismRequest<PrismExternalCreativeTicket>(event(eventId, `/external-creative-tickets/${ticketId}/complete`), withBase(options, { method: "POST", body: input })),
      venueScouting: (eventId) =>
        prismRequest<PrismVenueScouting>(event(eventId, "/venue-scouting"), withBase(options)),
      addVenueScoutingOption: (eventId, input) =>
        prismRequest<PrismVenueScoutingOption>(event(eventId, "/venue-scouting/options"), withBase(options, { method: "POST", body: input })),
      withdrawVenueScoutingOption: (eventId, optionId) =>
        prismRequest<PrismVenueScoutingOption>(event(eventId, `/venue-scouting/options/${optionId}/withdraw`), withBase(options, { method: "POST" })),
      publishVenueScouting: (eventId) =>
        prismRequest<PrismVenueScouting>(event(eventId, "/venue-scouting/publish"), withBase(options, { method: "POST" })),
      presentationMeetings: (eventId) =>
        prismRequest<PrismPresentationMeetings>(`/events/${encodeURIComponent(eventId)}/presentation-meetings`, withBase(options)),
      proposePresentationMeeting: (eventId, input) =>
        prismRequest<PrismPresentationMeeting>(`/events/${encodeURIComponent(eventId)}/presentation-meetings`, withBase(options, { method: "POST", body: input })),
      recordPresentationOutcome: (eventId, meetingId, input) =>
        prismRequest<PrismPresentationMeeting>(`/events/${encodeURIComponent(eventId)}/presentation-meetings/${encodeURIComponent(meetingId)}/outcome`, withBase(options, { method: "POST", body: input })),
      createClientBillingDispute: (eventId, input) =>
        prismRequest<PrismClientBillingDispute>(event(eventId, "/billing-disputes"), withBase(options, { method: "POST", body: input })),
      submitClientPayment: (eventId, input) =>
        prismRequest<PrismPaymentSubmission>(event(eventId, "/payment-submissions"), withBase(options, { method: "POST", body: input })),
      attachClientPaymentProof: (eventId, receiptId, input) =>
        prismRequest<PrismPaymentSubmission>(event(eventId, `/payment-submissions/${encodeURIComponent(receiptId)}/proof`), withBase(options, { method: "POST", body: input })),
      decideClientReviewItem: (eventId, itemId, input) =>
        prismRequest<unknown>(event(eventId, `/client-review-items/${itemId}/decisions`), withBase(options, { method: "POST", body: input })),
      chooseVenueScoutingPreference: (eventId, input) =>
        prismRequest<PrismVenueScouting>(event(eventId, "/venue-scouting/preference"), withBase(options, { method: "POST", body: input })),
      choosePresentationSlot: (eventId, meetingId, input) =>
        prismRequest<PrismPresentationMeeting>(`/events/${encodeURIComponent(eventId)}/presentation-meetings/${encodeURIComponent(meetingId)}/choice`, withBase(options, { method: "POST", body: input })),
      createClientOwnedSupplier: (eventId, input) =>
        prismRequest<PrismClientOwnedSupplier>(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers`, withBase(options, { method: "POST", body: input })),
      confirmClientOwnedSupplier: (eventId, supplierId) =>
        prismRequest<PrismClientOwnedSupplier>(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers/${encodeURIComponent(supplierId)}/confirm`, withBase(options, { method: "POST" })),
      unresponsiveSuppliers: (eventId) =>
        prismRequest<PrismUnresponsiveSupplier[]>(`/events/${encodeURIComponent(eventId)}/unresponsive-suppliers`, withBase(options)),
      clientOwnedSuppliers: (eventId) =>
        prismRequest<PrismClientOwnedSupplier[]>(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers`, withBase(options)),
      raiseClientSupplierRisk: (eventId, supplierId, input) =>
        prismRequest<PrismClientOwnedSupplier>(`/events/${encodeURIComponent(eventId)}/client-owned-suppliers/${encodeURIComponent(supplierId)}/risk-warning`, withBase(options, { method: "POST", body: input })),
      supplierGaps: (eventId) =>
        prismRequest<PrismSupplierGap[]>(event(eventId, "/supplier-gaps"), withBase(options)),
      acknowledgeSupplierGap: (eventId, categoryId, input) =>
        prismRequest<PrismSupplierGap>(event(eventId, `/supplier-gaps/${categoryId}/acknowledge`), withBase(options, { method: "POST", body: input })),
      supplierSchedules: (eventId) =>
        prismRequest<PrismSupplierSchedule[]>(`/events/${encodeURIComponent(eventId)}/supplier-schedules`, withBase(options)),
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
      selectSupplierQuote: (eventId, quoteId) =>
        prismRequest<PrismSupplierQuote>(event(eventId, `/supplier-quotes/${quoteId}/select`), withBase(options, { method: "PATCH" })),
    },
  };
}
