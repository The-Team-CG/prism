import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type {
  ChangeSupplierTierInput,
  CreateBillingSourceInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReviewInput,
  PromoteSupplierInput,
  PrismBillingSource,
  PrismBillingStatement,
  PrismPaymentMilestone,
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  RecordPaymentInput,
  RequestSupplierQuotesInput,
  UpdateSupplierInput,
} from "@prism/types";

export const commercialCommands = {
addSupplierCertification: (supplierId: string, input: CreateSupplierCertificationInput) =>
    request<PrismSupplier>(`/api/suppliers/${supplierId}/certifications`, {
      method: "POST",
      body: input,
    }),
addSupplierReview: (supplierId: string, input: CreateSupplierReviewInput) =>
    request<PrismSupplier>(`/api/suppliers/${supplierId}/reviews`, {
      method: "POST",
      body: input,
    }),
approveBillingSource: (eventId: string, sourceId: string, approvalNotes?: string) =>
    request<PrismBillingSource>(`/api/events/${eventId}/billing-source/${sourceId}/approve`, {
      method: "PATCH",
      body: { approvalNotes },
    }),
changeSupplierTier: (supplierId: string, input: ChangeSupplierTierInput) =>
    request<PrismSupplier>(`/api/suppliers/${supplierId}/tier`, {
      method: "PATCH",
      body: input,
    }),
createBillingSource: (eventId: string, input: CreateBillingSourceInput) =>
    request<PrismBillingSource>(`/api/events/${eventId}/billing-source`, {
      method: "POST",
      body: input,
    }),
createSupplier: (input: CreateSupplierInput) =>
    request<PrismSupplier>("/api/suppliers", {
      method: "POST",
      body: input,
    }),
generateBillingStatement: (eventId: string, sourceId?: string) =>
    request<PrismBillingStatement>(`/api/events/${eventId}/billing-statements/generate`, {
      method: "POST",
      body: { sourceId },
    }),
recordPayment: (eventId: string, milestoneId: string, input: RecordPaymentInput) =>
    request<PrismPaymentMilestone>(`/api/events/${eventId}/payments/${milestoneId}/records`, {
      method: "POST",
      body: input,
    }),
requestSupplierQuotes: (eventId: string, input: RequestSupplierQuotesInput) =>
    request<PrismSupplierQuoteRequest[]>(`/api/events/${eventId}/quote-requests`, {
      method: "POST",
      body: input,
    }),
selectSupplierQuote: (eventId: string, quoteId: string) =>
    request<PrismSupplierQuote>(`/api/events/${eventId}/supplier-quotes/${quoteId}/select`, { method: "PATCH" }),
sendBillingStatement: (eventId: string, billingId: string) =>
    request<PrismBillingStatement>(`/api/events/${eventId}/billing-statements/${billingId}/send`, { method: "POST" }),
updateSupplier: (supplierId: string, input: UpdateSupplierInput) =>
    request<PrismSupplier>(`/api/suppliers/${supplierId}`, {
      method: "PATCH",
      body: input,
    }),
promoteSupplier: (supplierId: string, input: PromoteSupplierInput) =>
    request<PrismSupplier>(`/api/suppliers/${supplierId}/promote`, {
      method: "POST",
      body: input,
    }),
withdrawSupplier: (eventId: string, requestId: string) =>
    request<{ ok: boolean }>(`/api/events/${eventId}/quote-requests/${requestId}/withdraw`, { method: "PATCH" }),
};
