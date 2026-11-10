import type {
  PrismAdditionalBilling,
  PrismBillingCorrection,
  PrismBillingDispute,
  PrismBillingSource,
  PrismBillingStatement,
  PrismPaymentMilestone,
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierQuoteRoundComparison,
} from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createCommercialClient(options: EventOpsClientOptions): Pick<EventOpsClient, "commercial"> {
  const event = (eventId: string, rest: string) => `/events/${eventId}${rest}`;
  const supplier = (supplierId: string, rest = "") => `/suppliers/${encodeURIComponent(supplierId)}${rest}`;
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
      selectSupplierQuote: (eventId, quoteId, actor = {}) =>
        prismRequest<PrismSupplierQuote>(actorPath(event(eventId, `/supplier-quotes/${quoteId}/select`), actor), withBase(options, { method: "PATCH" })),
    },
  };
}
